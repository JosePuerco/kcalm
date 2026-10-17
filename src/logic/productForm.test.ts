import { describe, expect, it } from 'vitest'
import { NUTRIENT_KEYS, unknownNutrients } from '../db/records.ts'
import { formatNutrient } from './nutrientInfo.ts'
import {
  emptyProductForm,
  parseDecimal,
  productToForm,
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
    nutrients: { ...base.nutrients, kcal: '63', ...changes.nutrients },
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
  it('Minimalprodukt: Name + kcal, Rest unbekannt', () => {
    const r = validateProductForm(form())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.name).toBe('Skyr natur')
    expect(r.data.per100.kcal).toBe(63)
    for (const key of NUTRIENT_KEYS.filter((k) => k !== 'kcal')) expect(r.data.per100[key]).toBeNull()
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

  it('kcal ist Pflicht', () => {
    expect(errorsOf(form({ nutrients: { kcal: '' } }))).toEqual({ kcal: 'Bitte kcal eingeben' })
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
    // Gleich ist erlaubt, unbekannter Oberwert auch
    expect(errorsOf(form({ nutrients: { carbs: '4', sugar: '4' } }))).toEqual({})
    expect(errorsOf(form({ nutrients: { satFat: '6' } }))).toEqual({})
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
    per100: { ...unknownNutrients(), kcal: 47, fat: 1.5, salt: 0.13 },
    isDrink: true,
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
