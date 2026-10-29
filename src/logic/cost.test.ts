import { describe, expect, it } from 'vitest'
import { unknownNutrients } from '../db/records.ts'
import type { FoodRef, LocalDate, Price } from '../db/types.ts'
import {
  addSums,
  basePriceText,
  buildCostStats,
  costDays,
  costForAmount,
  costText,
  costTiles,
  entryCost,
  formatEuro,
  itemsCost,
  missingPrices,
  priceLookup,
  QUICK_GROUP_NAME,
  recipeUnitPrice,
  sumCosts,
  topFoods,
  unitPrice,
  validatePrice,
  validateQuickCost,
  valueRatios,
  type PriceSources,
  type UnitPriceLookup,
} from './cost.ts'

const alive = { deletedAt: null }
const hafer: Price = { amount: 0.89, per: 500 }
const skyr: Price = { amount: 1.49, per: 450 }

const sources: PriceSources = {
  products: [
    { id: 'hafer', price: hafer, ...alive },
    { id: 'skyr', price: skyr, ...alive },
    { id: 'ohne', price: null, ...alive },
    { id: 'weg', price: { amount: 5, per: 100 }, deletedAt: '2026-10-01T00:00:00.000Z' },
  ],
  blsPrefs: [{ blsCode: 'M111000', price: { amount: 1.19, per: 1000 }, ...alive }],
  recipes: [
    // Porridge: 100 g Hafer + 500 ml Milch → 550 g fertig
    { id: 'porridge', ingredients: [{ ref: 'product:hafer', amount: 100 }, { ref: 'bls:M111000', amount: 500 }], finalWeightG: 550, ...alive },
    { id: 'halb', ingredients: [{ ref: 'product:hafer', amount: 100 }, { ref: 'product:ohne', amount: 50 }], finalWeightG: 150, ...alive },
  ],
}
const lookup = priceLookup(sources)

function food(ref: FoodRef, amount: number, date: LocalDate = '2026-10-26', kcal: number | null = 100, protein: number | null = 10) {
  return {
    date,
    kind: 'food' as const,
    ref,
    amount,
    cost: null,
    nameSnapshot: ref.slice(ref.indexOf(':') + 1),
    nutrients: { ...unknownNutrients(), kcal, protein },
  }
}
function quick(cost: number | null, date: LocalDate = '2026-10-26', kcal: number | null = 800) {
  return { date, kind: 'quick' as const, ref: null, amount: null, cost, nameSnapshot: 'Kantine', nutrients: { ...unknownNutrients(), kcal } }
}

describe('unitPrice', () => {
  it('€ je g: 0,89 € für 500 g', () => {
    expect(unitPrice(hafer)).toBeCloseTo(0.00178, 10)
  })
  it('ohne Preis, Packung 0, negativ oder NaN → unbekannt', () => {
    expect(unitPrice(null)).toBeNull()
    expect(unitPrice({ amount: 1, per: 0 })).toBeNull()
    expect(unitPrice({ amount: -1, per: 100 })).toBeNull()
    expect(unitPrice({ amount: Number.NaN, per: 100 })).toBeNull()
  })
  it('0 € ist ein bekannter Preis (geschenkt)', () => {
    expect(unitPrice({ amount: 0, per: 100 })).toBe(0)
  })
})

describe('costForAmount', () => {
  it('exakt, ohne Zwischenrundung', () => {
    expect(costForAmount(unitPrice(hafer), 60)).toBeCloseTo(0.1068, 10)
  })
  it('unbekannter Preis oder Menge bleibt unbekannt, nie 0', () => {
    expect(costForAmount(null, 60)).toBeNull()
    expect(costForAmount(0.01, null)).toBeNull()
    expect(costForAmount(0.01, -5)).toBeNull()
  })
})

describe('sumCosts / addSums', () => {
  it('leer = bekannt 0', () => {
    expect(sumCosts([])).toEqual({ value: 0, atLeast: false })
  })
  it('unbekannte Teile machen die Summe zu „mind.“', () => {
    expect(sumCosts([1, null, 2])).toEqual({ value: 3, atLeast: true })
  })
  it('alle unbekannt → unbekannt, nicht „mind. 0“', () => {
    expect(sumCosts([null, null])).toEqual({ value: null, atLeast: false })
  })
  it('addSums übernimmt „mind.“ aus den Teilsummen', () => {
    expect(addSums([{ value: 2, atLeast: true }, { value: 3, atLeast: false }])).toEqual({ value: 5, atLeast: true })
    expect(addSums([{ value: null, atLeast: false }])).toEqual({ value: null, atLeast: false })
    expect(addSums([])).toEqual({ value: 0, atLeast: false })
  })
})

describe('priceLookup', () => {
  it('Produkt und BLS', () => {
    expect(lookup('product:skyr')).toBeCloseTo(1.49 / 450, 12)
    expect(lookup('bls:M111000')).toBeCloseTo(0.00119, 12)
  })
  it('ohne Preis, gelöscht oder unbekannt → null', () => {
    expect(lookup('product:ohne')).toBeNull()
    expect(lookup('product:weg')).toBeNull()
    expect(lookup('product:gibtsnicht')).toBeNull()
    expect(lookup('bls:X')).toBeNull()
  })
  it('Rezept aus den Zutaten: (0,178 + 0,595) € ÷ 550 g', () => {
    expect(lookup('recipe:porridge')).toBeCloseTo((0.178 + 0.595) / 550, 12)
  })
  it('Rezept mit Zutat ohne Preis → unbekannt', () => {
    expect(lookup('recipe:halb')).toBeNull()
  })
  it('Rezept im Rezept gilt als unbekannt (keine Endlosschleife)', () => {
    const loop = priceLookup({
      ...sources,
      recipes: [{ id: 'a', ingredients: [{ ref: 'recipe:a', amount: 100 }], finalWeightG: 100, ...alive }],
    })
    expect(loop('recipe:a')).toBeNull()
  })
  it('immer aktueller Preis: neuer Preis gilt auch rückwirkend', () => {
    const e = food('product:hafer', 100)
    expect(entryCost(e, lookup)).toBeCloseTo(0.178, 10)
    const later = priceLookup({ ...sources, products: [{ id: 'hafer', price: { amount: 1.29, per: 500 }, ...alive }] })
    expect(entryCost(e, later)).toBeCloseTo(0.258, 10)
  })
})

describe('itemsCost / recipeUnitPrice', () => {
  it('Topf: Summe der Zutaten', () => {
    expect(itemsCost(sources.recipes[0]!.ingredients, lookup).value).toBeCloseTo(0.773, 10)
  })
  it('Topf mit Zutat ohne Preis: „mind.“', () => {
    expect(itemsCost(sources.recipes[1]!.ingredients, lookup)).toMatchObject({ atLeast: true })
  })
  it('missingPrices: jede Zutat ohne Preis einmal', () => {
    const items = [{ ref: 'product:ohne' as const }, { ref: 'product:hafer' as const }, { ref: 'product:ohne' as const }]
    expect(missingPrices(items, lookup)).toEqual(['product:ohne'])
    expect(missingPrices([], lookup)).toEqual([])
  })
  it('ohne Zutaten oder ohne Endgewicht → unbekannt', () => {
    expect(recipeUnitPrice({ ingredients: [], finalWeightG: 500 }, lookup)).toBeNull()
    expect(recipeUnitPrice({ ingredients: sources.recipes[0]!.ingredients, finalWeightG: 0 }, lookup)).toBeNull()
  })
})

describe('entryCost', () => {
  it('Lebensmittel: aktueller Preis × Menge', () => {
    expect(entryCost(food('product:skyr', 150), lookup)).toBeCloseTo(0.4967, 4)
  })
  it('Schnelleintrag: gespeicherter Preis, auch 0 und unbekannt', () => {
    expect(entryCost(quick(12.9), lookup)).toBe(12.9)
    expect(entryCost(quick(0), lookup)).toBe(0)
    expect(entryCost(quick(null), lookup)).toBeNull()
  })
  it('Lebensmittel ignoriert ein (falsch) gesetztes cost', () => {
    expect(entryCost({ ...food('product:ohne', 100), cost: 5 }, lookup)).toBeNull()
  })
})

describe('Anzeige', () => {
  it('formatEuro: zwei Stellen, deutsches Format, unbekannt „–“', () => {
    expect(formatEuro(1.49)).toBe('1,49 €')
    expect(formatEuro(1234.5)).toBe('1.234,50 €')
    expect(formatEuro(0.004)).toBe('0,00 €')
    expect(formatEuro(null)).toBe('–')
  })
  it('costText mit „mind.“', () => {
    expect(costText({ value: 12.4, atLeast: true })).toBe('mind. 12,40 €')
  })
  it('Grundpreis €/kg bzw. €/l', () => {
    expect(basePriceText(hafer, 'g')).toBe('1,78 €/kg')
    expect(basePriceText({ amount: 1.19, per: 1000 }, 'ml')).toBe('1,19 €/l')
    expect(basePriceText(null, 'g')).toBeNull()
  })
})

describe('validatePrice', () => {
  it('beide leer = kein Preis', () => {
    expect(validatePrice({ amount: ' ', per: '' })).toEqual({ ok: true, price: null })
  })
  it('Dezimalkomma und Punkt', () => {
    expect(validatePrice({ amount: '1,49', per: '500' })).toEqual({ ok: true, price: { amount: 1.49, per: 500 } })
    expect(validatePrice({ amount: '1.49', per: '12,5' })).toEqual({ ok: true, price: { amount: 1.49, per: 12.5 } })
  })
  it('nur eins ausgefüllt → das andere fehlt', () => {
    expect(validatePrice({ amount: '1,49', per: '' })).toEqual({ ok: false, errors: { per: 'Packungsgröße fehlt' } })
    expect(validatePrice({ amount: '', per: '500' })).toEqual({ ok: false, errors: { amount: 'Preis fehlt' } })
  })
  it('ungültig, Packung 0, zu groß', () => {
    expect(validatePrice({ amount: 'abc', per: '0' })).toEqual({
      ok: false,
      errors: { amount: 'Keine gültige Zahl', per: 'Muss größer als 0 sein' },
    })
    expect(validatePrice({ amount: '1490', per: '100001' })).toEqual({
      ok: false,
      errors: { amount: 'Höchstens 1.000 €', per: 'Höchstens 100.000' },
    })
  })
  it('0 € ist erlaubt', () => {
    expect(validatePrice({ amount: '0', per: '100' })).toEqual({ ok: true, price: { amount: 0, per: 100 } })
  })
})

describe('validateQuickCost', () => {
  it('leer = unbekannt, Komma, Grenzen', () => {
    expect(validateQuickCost('')).toEqual({ ok: true, cost: null })
    expect(validateQuickCost('12,90')).toEqual({ ok: true, cost: 12.9 })
    expect(validateQuickCost('x')).toEqual({ ok: false, error: 'Keine gültige Zahl' })
    expect(validateQuickCost('1001')).toEqual({ ok: false, error: 'Höchstens 1.000 €' })
  })
})

describe('costDays / costTiles', () => {
  const today = '2026-10-28' // Mittwoch
  const dates = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29']
  const days = (entries: ReturnType<typeof food | typeof quick>[], complete: LocalDate[]) =>
    costDays({ today, dates, entries, completeDates: new Set(complete), lookup })

  it('Zustand wie in der kcal-Statistik, Kosten je Tag', () => {
    const d = days([quick(10, '2026-10-26'), quick(null, '2026-10-27'), quick(3, '2026-10-29')], ['2026-10-26'])
    expect(d.map((x) => x.state)).toEqual(['complete', 'incomplete', 'empty', 'future'])
    expect(d[0]!.cost).toEqual({ value: 10, atLeast: false })
    expect(d[1]!.cost).toEqual({ value: null, atLeast: false })
  })

  it('Ø nur über vollständige Tage, Summe über alle Tage mit Einträgen bis heute', () => {
    const d = days([quick(10, '2026-10-26'), quick(6, '2026-10-27'), quick(3, '2026-10-29')], ['2026-10-26'])
    expect(costTiles(d)).toEqual({ avgPerDay: { value: 10, atLeast: false }, total: { value: 16, atLeast: false } })
  })

  it('Tag ohne Preis macht die Summe zu „mind.“', () => {
    const d = days([quick(10, '2026-10-26'), quick(null, '2026-10-27')], [])
    expect(costTiles(d)).toEqual({ avgPerDay: null, total: { value: 10, atLeast: true } })
  })

  it('keine Einträge: Ø unbekannt, Summe 0', () => {
    expect(costTiles(days([], []))).toEqual({ avgPerDay: null, total: { value: 0, atLeast: false } })
  })
})

describe('valueRatios', () => {
  it('€ je 1.000 kcal und je 100 g Eiweiß', () => {
    // 100 g Hafer 0,178 € mit 372 kcal und 13 g Eiweiß
    const r = valueRatios([food('product:hafer', 100, '2026-10-26', 372, 13)], lookup)
    expect(r.perThousandKcal).toBeCloseTo(0.4785, 4)
    expect(r.perHundredProtein).toBeCloseTo(1.3692, 4)
  })
  it('nur Einträge mit Preis und bekanntem Nährwert', () => {
    const r = valueRatios(
      [
        food('product:hafer', 100, '2026-10-26', 372, null), // Eiweiß unbekannt: zählt nur für kcal
        food('product:ohne', 100, '2026-10-26', 5000, 500), // ohne Preis: zählt gar nicht
        quick(2, '2026-10-26', 628),
      ],
      lookup,
    )
    expect(r.perThousandKcal).toBeCloseTo(2.178, 10)
    expect(r.perHundredProtein).toBeNull()
  })
  it('keine Einträge → unbekannt', () => {
    expect(valueRatios([], lookup)).toEqual({ perThousandKcal: null, perHundredProtein: null })
  })
})

describe('topFoods', () => {
  it('nach Kosten absteigend, mit Anteil; Schnelleinträge zusammen', () => {
    const top = topFoods(
      [food('product:skyr', 450), food('product:skyr', 450), food('product:hafer', 500), quick(10), quick(5), quick(null)],
      lookup,
    )
    expect(top.map((t) => [t.key, t.entries])).toEqual([
      ['quick', 2],
      ['product:skyr', 2],
      ['product:hafer', 1],
    ])
    expect(top[0]).toMatchObject({ name: QUICK_GROUP_NAME, cost: 15 })
    expect(top[0]!.share).toBeCloseTo(15 / (15 + 2.98 + 0.89), 10)
  })
  it('höchstens 5, ohne Preis und 0 € nicht in der Liste', () => {
    const fixed = (perUnit: number | null): UnitPriceLookup => (ref) => (ref === 'product:gratis' ? 0 : perUnit)
    const entries = ['a', 'b', 'c', 'd', 'e', 'f', 'gratis'].map((n, i) => food(`product:${n}`, 100 + i))
    const top = topFoods(entries, fixed(0.01))
    expect(top).toHaveLength(5)
    expect(top[0]!.key).toBe('product:f')
    expect(topFoods([food('product:ohne', 100)], lookup)).toEqual([])
  })
  it('Name aus dem jüngsten Eintrag', () => {
    const old = { ...food('product:skyr', 100, '2026-10-01'), nameSnapshot: 'Skyr alt' }
    const neu = { ...food('product:skyr', 100, '2026-10-20'), nameSnapshot: 'Skyr natur' }
    expect(topFoods([neu, old], lookup)[0]!.name).toBe('Skyr natur')
  })
})

describe('buildCostStats', () => {
  const today = '2026-10-28'
  it('Woche: 7 Balken, Kacheln, nur Einträge des Zeitraums bis heute', () => {
    const s = buildCostStats('week', {
      today,
      entries: [quick(10, '2026-10-26'), quick(99, '2026-10-19'), quick(50, '2026-10-30'), food('product:ohne', 100, '2026-10-27')],
      completeDates: new Set(['2026-10-26']),
      lookup,
    })
    expect(s.bars).toHaveLength(7)
    expect(s.bars[0]).toMatchObject({ value: { value: 10, atLeast: false }, full: true, caption: 'Mo 26.10.: 10,00 €' })
    expect(s.bars[1]).toMatchObject({ value: { value: null, atLeast: false }, full: false })
    expect(s.tiles.total).toEqual({ value: 10, atLeast: true })
    expect(s.top.map((t) => t.cost)).toEqual([10])
    expect(s.withoutPrice).toBe(1)
    expect(s.scale).toBe(10)
  })
  it('3 Monate: Wochenbalken mit Ø der vollständigen Tage', () => {
    const s = buildCostStats('quarter', {
      today,
      entries: [quick(10, '2026-10-26'), quick(20, '2026-10-27')],
      completeDates: new Set(['2026-10-26', '2026-10-27']),
      lookup,
    })
    expect(s.bars).toHaveLength(13)
    expect(s.bars[12]).toMatchObject({ value: { value: 15, atLeast: false }, caption: 'KW 44: Ø 15,00 € · 2 von 7 Tagen vollständig' })
  })
})
