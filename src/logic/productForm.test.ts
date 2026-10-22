import { describe, expect, it } from 'vitest'
import { unknownNutrients } from '../db/records.ts'
import { formatNutrient, REQUIRED_NUTRIENTS } from './nutrientInfo.ts'
import {
  nutrientsToForm,
  validateCorrectionForm,
  emptyProductForm,
  parseDecimal,
  productToForm,
  validatePortion,
  validateProductForm,
  type ProductFormData,
  type ProductFormValues,
} from './productForm.ts'

function form(changes: Partial<Omit<ProductFormValues, 'nutrients'>> & { nutrients?: Partial<ProductFormValues['nutrients']> } = {}) {
  const base = emptyProductForm()
  return {
    ...base,
    name: 'Skyr natur',
    ...changes,
    // Alle Pflichtwerte vom Etikett ausgefüllt (Skyr)
    nutrients: {
      ...base.nutrients,
      kcal: '63',
      fat: '0,2',
      satFat: '0,1',
      carbs: '4',
      sugar: '4',
      protein: '11',
      salt: '0,13',
      ...changes.nutrients,
    },
  }
}

function errorsOf(values: ProductFormValues) {
  const r = validateProductForm(values)
  return r.ok ? {} : r.errors
}

describe('parseDecimal', () => {
  it('liest Dezimalkomma und Punkt', () => {
    expect(parseDecimal('12,5')).toBe(12.5)
    expect(parseDecimal('12.5')).toBe(12.5)
    expect(parseDecimal('12')).toBe(12)
    expect(parseDecimal(' 0,13 ')).toBe(0.13)
  })

  it('verzeiht halbe Eingaben', () => {
    expect(parseDecimal('12,')).toBe(12)
    expect(parseDecimal(',5')).toBe(0.5)
  })

  it('leer heißt unbekannt (null), nicht 0', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('   ')).toBeNull()
    expect(parseDecimal('0')).toBe(0)
  })

  it('erkennt Ungültiges', () => {
    for (const bad of ['-5', '1,2,3', '1.234,5', 'abc', '5 g', ',', '1e3']) {
      expect(parseDecimal(bad), bad).toBe('invalid')
    }
  })
})

describe('validateProductForm', () => {
  it('Minimalprodukt: Name + Pflichtwerte vom Etikett, Rest unbekannt', () => {
    const r = validateProductForm(form())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.name).toBe('Skyr natur')
    expect(r.data.per100).toEqual({
      kcal: 63,
      fat: 0.2,
      satFat: 0.1,
      carbs: 4,
      sugar: 4,
      fiber: null,
      protein: 11,
      salt: 0.13,
    })
    expect(r.data.brand).toBeNull()
    expect(r.data.barcode).toBeNull()
    expect(r.data.portions).toEqual([])
  })

  it('übernimmt alle Werte exakt mit Dezimalkomma', () => {
    const r = validateProductForm(
      form({
        brand: ' Arla ',
        barcode: '4002971243802',
        nutrients: { fat: '0,2', satFat: '0,1', carbs: '4', sugar: '4', fiber: '0', protein: '11', salt: '0,13' },
      }),
    )
    expect(r.ok && r.data).toMatchObject({
      brand: 'Arla',
      barcode: '4002971243802',
      per100: { kcal: 63, fat: 0.2, satFat: 0.1, carbs: 4, sugar: 4, fiber: 0, protein: 11, salt: 0.13 },
    })
  })

  it('Name ist Pflicht und wird getrimmt', () => {
    expect(errorsOf(form({ name: '   ' }))).toEqual({ name: 'Bitte einen Namen eingeben' })
    const r = validateProductForm(form({ name: '  Skyr  ' }))
    expect(r.ok && r.data.name).toBe('Skyr')
  })

  it('alle Pflichtwerte der EU-Nährwerttabelle müssen ausgefüllt sein', () => {
    expect([...REQUIRED_NUTRIENTS]).toEqual(['kcal', 'fat', 'satFat', 'carbs', 'sugar', 'protein', 'salt'])
    const empty = Object.fromEntries(REQUIRED_NUTRIENTS.map((k) => [k, '']))
    const expected = Object.fromEntries(REQUIRED_NUTRIENTS.map((k) => [k, 'Pflichtangabe vom Etikett']))
    expect(errorsOf(form({ nutrients: empty }))).toEqual(expected)
    // jeder einzeln
    for (const key of REQUIRED_NUTRIENTS) {
      expect(errorsOf(form({ nutrients: { [key]: ' ' } })), key).toEqual({ [key]: 'Pflichtangabe vom Etikett' })
    }
  })

  it('Ballaststoffe bleiben optional', () => {
    const r = validateProductForm(form({ nutrients: { fiber: '' } }))
    expect(r.ok && r.data.per100.fiber).toBeNull()
  })

  it('0 ist eine gültige Pflichtangabe', () => {
    const r = validateProductForm(form({ nutrients: { fat: '0', satFat: '0', salt: '0' } }))
    expect(r.ok && r.data.per100.salt).toBe(0)
  })

  it('meldet Tippfehler am richtigen Feld', () => {
    expect(errorsOf(form({ nutrients: { fat: '1,2,3', kcal: 'x' } }))).toEqual({
      fat: 'Keine gültige Zahl',
      kcal: 'Keine gültige Zahl',
    })
  })

  it('blockiert Unmögliches: über 900 kcal, über 100 g', () => {
    expect(errorsOf(form({ nutrients: { kcal: '901' } }))).toHaveProperty('kcal')
    expect(errorsOf(form({ nutrients: { kcal: '900' } }))).toEqual({})
    expect(errorsOf(form({ nutrients: { protein: '100,1' } }))).toHaveProperty('protein')
    expect(errorsOf(form({ nutrients: { salt: '100' } }))).toEqual({})
  })

  it('„davon“ darf nicht größer sein als der Oberwert', () => {
    expect(errorsOf(form({ nutrients: { fat: '5', satFat: '6' } }))).toEqual({ satFat: 'Mehr als Fett gesamt' })
    expect(errorsOf(form({ nutrients: { carbs: '4', sugar: '4,5' } }))).toEqual({
      sugar: 'Mehr als Kohlenhydrate gesamt',
    })
    // Gleich ist erlaubt; fehlt der Oberwert, kommt nur der Pflicht-Hinweis
    expect(errorsOf(form({ nutrients: { carbs: '4', sugar: '4' } }))).toEqual({})
    expect(errorsOf(form({ nutrients: { fat: '', satFat: '6' } }))).toEqual({ fat: 'Pflichtangabe vom Etikett' })
  })

  it('zeigt alle Fehler auf einmal, auch Querprüfungen', () => {
    expect(errorsOf(form({ name: '', nutrients: { fat: '5', satFat: '6' } }))).toEqual({
      name: 'Bitte einen Namen eingeben',
      satFat: 'Mehr als Fett gesamt',
    })
  })

  it('Barcode: optional, nur Ziffern', () => {
    expect(errorsOf(form({ barcode: '' }))).toEqual({})
    expect(errorsOf(form({ barcode: '40029712' }))).toEqual({})
    expect(errorsOf(form({ barcode: '4002-971' }))).toHaveProperty('barcode')
    expect(errorsOf(form({ barcode: '123' }))).toHaveProperty('barcode')
  })

  it('Portionen: Name und Menge > 0, leere Zeilen werden ignoriert', () => {
    const r = validateProductForm(
      form({
        portions: [
          { label: '1 Becher', amount: '450' },
          { label: '', amount: '' },
          { label: ' Halber Becher ', amount: '225,5' },
        ],
      }),
    )
    expect(r.ok && r.data.portions).toEqual([
      { label: '1 Becher', amount: 450 },
      { label: 'Halber Becher', amount: 225.5 },
    ])
  })

  it('Portionsfehler zeigen auf die Zeile im Formular, auch nach leeren Zeilen', () => {
    const errors = errorsOf(
      form({
        portions: [
          { label: '', amount: '' },
          { label: '1 Becher', amount: '0' },
          { label: '', amount: '30' },
          { label: '1 becher', amount: 'x' },
        ],
      }),
    )
    expect(errors).toEqual({
      'portions.1.amount': 'Mehr als 0',
      'portions.2.label': 'Bitte benennen',
      'portions.3.amount': 'Keine gültige Zahl',
      'portions.3.label': 'Gibt es schon',
    })
  })
})

describe('productToForm', () => {
  const product: ProductFormData = {
    name: 'Milch 1,5 %',
    brand: null,
    barcode: null,
    unit: 'ml',
    per100: { ...unknownNutrients(), kcal: 47, fat: 1.5, satFat: 1, carbs: 4.9, sugar: 4.9, protein: 3.4, salt: 0.13 },
    portions: [{ label: '1 Glas', amount: 250 }],
  }

  it('zeigt Zahlen exakt mit Komma, unbekannt als leeres Feld', () => {
    const v = productToForm(product)
    expect(v.nutrients.kcal).toBe('47')
    expect(v.nutrients.fat).toBe('1,5')
    expect(v.nutrients.fiber).toBe('')
    expect(v.brand).toBe('')
    expect(v.portions).toEqual([{ label: '1 Glas', amount: '250' }])
  })

  it('hin und zurück ergibt dasselbe Produkt', () => {
    const r = validateProductForm(productToForm(product))
    expect(r.ok && r.data).toEqual(product)
  })
})

describe('validateCorrectionForm', () => {
  const skyr = { ...unknownNutrients(), kcal: 63, fat: 0.2, satFat: 0.1, carbs: 4, sugar: 4, protein: 11, salt: 0.1 }

  it('Komma-Zahlen exakt, leeres Feld = unbekannt (auch Pflichtangaben)', () => {
    const form = { ...nutrientsToForm(skyr), carbs: '4,5', salt: '' }
    expect(validateCorrectionForm(form)).toEqual({ ok: true, per100: { ...skyr, carbs: 4.5, salt: null } })
  })

  it('nutrientsToForm zeigt exakte Werte mit Komma', () => {
    expect(nutrientsToForm(skyr)).toMatchObject({ kcal: '63', fat: '0,2', fiber: '' })
  })

  it('Tippfehler, Höchstwerte und Querprüfungen', () => {
    const form = { ...nutrientsToForm(skyr), kcal: '1000', protein: '12,3,4', sugar: '5', fat: '101' }
    const result = validateCorrectionForm(form)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toEqual({
      kcal: 'Höchstens 900 kcal pro 100',
      protein: 'Keine gültige Zahl',
      fat: 'Höchstens 100 g pro 100',
      sugar: 'Mehr als Kohlenhydrate gesamt',
    })
  })
})

describe('formatNutrient', () => {
  it('rundet nur für die Anzeige, „–“ bei unbekannt', () => {
    expect(formatNutrient('kcal', 63.4)).toBe('63 kcal')
    expect(formatNutrient('fat', 0.24)).toBe('0,2 g')
    expect(formatNutrient('protein', 11)).toBe('11,0 g')
    expect(formatNutrient('salt', 0.125)).toBe('0,13 g')
    expect(formatNutrient('fiber', null)).toBe('–')
    expect(formatNutrient('fiber', 0)).toBe('0,0 g')
  })
})

describe('validatePortion', () => {
  it('liefert eine gültige Portion, getrimmt', () => {
    expect(validatePortion({ label: ' 1 Becher ', amount: '450' }, [])).toEqual({
      ok: true,
      portion: { label: '1 Becher', amount: 450 },
    })
    expect(validatePortion({ label: 'Scheibe', amount: '12,5' }, [])).toMatchObject({ portion: { amount: 12.5 } })
  })

  it('meldet fehlenden Namen und fehlende oder ungültige Menge zusammen', () => {
    expect(validatePortion({ label: '', amount: '' }, [])).toEqual({
      ok: false,
      errors: { label: 'Bitte benennen', amount: 'Bitte Menge eingeben' },
    })
    expect(validatePortion({ label: 'A', amount: '0' }, [])).toEqual({ ok: false, errors: { amount: 'Mehr als 0' } })
    expect(validatePortion({ label: 'A', amount: 'x' }, [])).toEqual({ ok: false, errors: { amount: 'Keine gültige Zahl' } })
  })

  it('erkennt doppelte Namen ohne Rücksicht auf Groß-/Kleinschreibung', () => {
    expect(validatePortion({ label: '1 becher', amount: '450' }, ['1 Becher'])).toEqual({
      ok: false,
      errors: { label: 'Gibt es schon' },
    })
  })
})
