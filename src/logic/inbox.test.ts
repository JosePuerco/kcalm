import { describe, expect, it } from 'vitest'
import { newRecord, unknownNutrients } from '../db/records.ts'
import type { FoodRef, Meal, Slot } from '../db/types.ts'
import type { FoodChoice } from './addFood.ts'
import {
  bestMatch,
  ESTIMATE_SOURCE,
  estimateFood,
  estimatePer100,
  parseInbox,
  resolvePart,
  scaleEstimate,
  slotIdFor,
  suggestionCountLabel,
  suggestionEntries,
  suggestionsForDay,
  visibleSuggestions,
  type EntrySuggestion,
  type Suggestion,
} from './inbox.ts'
import { createSearchIndex } from './search.ts'

const G = '0193a000-0000-7000-8000-0000000000aa'
let n = 0
const id = () => `0193a000-0000-7000-8000-${String(++n).padStart(12, '0')}`

function payload(changes: Partial<EntrySuggestion> = {}): EntrySuggestion {
  return {
    slot: null,
    group: null,
    ref: null,
    name: 'Chili',
    amount: 450,
    unit: 'g',
    kcal: 610,
    protein: 38,
    carbs: null,
    sugar: null,
    fat: 25,
    satFat: null,
    fiber: null,
    salt: 2.7,
    ...changes,
  }
}

function suggestion(changes: Partial<EntrySuggestion> = {}, date = '2026-11-20', createdAt = '2026-11-20T12:00:00.000Z'): Suggestion {
  return { id: id(), kind: 'entry', date, createdAt, payload: payload(changes) }
}

function food(ref: FoodRef, name: string, kcal: number, extra: Partial<FoodChoice> = {}): FoodChoice {
  return {
    ref,
    name,
    source: 'Eigenes Produkt',
    verified: true,
    unit: 'g',
    per100: { ...unknownNutrients(), kcal, protein: 12 },
    portions: [{ label: '1 Becher', amount: 250 }],
    archived: false,
    ...extra,
  }
}

const quark = food('product:p1', 'Magerquark', 67)
const quarkKorrigiert = food('product:p2', 'Skyr', 63, { per100: { ...unknownNutrients(), kcal: 60, protein: 11 } })
const alt = food('product:p3', 'Alter Joghurt', 80, { archived: true })
const foods = new Map<FoodRef, FoodChoice>([
  [quark.ref, quark],
  [quarkKorrigiert.ref, quarkKorrigiert],
  [alt.ref, alt],
])
const resolve = (ref: FoodRef) => foods.get(ref)

const meal = newRecord<Meal>({ name: 'Quark-Frühstück', items: [{ ref: 'product:p1', amount: 250, unit: 'g', portionLabel: null }], archived: false })
const meals = new Map([[meal.id, meal]])
const findMeal = (mealId: string) => meals.get(mealId)

describe('parseInbox', () => {
  it('kaputtes Item fällt weg, der Rest bleibt', () => {
    const good = suggestion()
    const json = {
      ok: true,
      items: [good, { ...suggestion(), payload: { ...payload(), kcal: -5 } }, { ...suggestion(), kind: 'weight' }, { id: 'x' }],
    }
    expect(parseInbox(json)).toEqual([good])
  })

  it('kcal null bleibt null (bei Verweis erlaubt), 0 bleibt 0', () => {
    const a = suggestion({ ref: { type: 'product', id: 'p1' }, kcal: null })
    const b = suggestion({ sugar: 0 })
    const [pa, pb] = parseInbox({ ok: true, items: [a, b] })
    expect(pa!.payload.kcal).toBeNull()
    expect(pb!.payload.sugar).toBe(0)
  })

  it('keine Kcalm-Antwort → leer', () => {
    expect(parseInbox({ ok: false })).toEqual([])
    expect(parseInbox(null)).toEqual([])
  })
})

describe('visibleSuggestions', () => {
  it('entschiedene und abgelaufene fehlen', () => {
    const a = suggestion({}, '2026-11-20')
    const b = suggestion({}, '2026-11-13')
    const c = suggestion({}, '2026-11-12')
    expect(visibleSuggestions([a, b, c], new Set([a.id]), '2026-11-20')).toEqual([b])
  })
})

describe('suggestionsForDay', () => {
  it('Gruppe und Einzelvorschlag, nach Eingang sortiert', () => {
    const g1 = suggestion({ group: { id: G, name: 'Chili con Carne' } }, '2026-11-20', '2026-11-20T12:00:00.000Z')
    const g2 = suggestion({ group: { id: G, name: 'Chili con Carne' }, name: 'Reis' }, '2026-11-20', '2026-11-20T12:00:00.000Z')
    const single = suggestion({ name: 'Apfel' }, '2026-11-20', '2026-11-20T08:00:00.000Z')
    const other = suggestion({}, '2026-11-19')
    expect(suggestionsForDay([g1, g2, single, other], '2026-11-20')).toEqual([
      { id: single.id, name: null, items: [single] },
      { id: G, name: 'Chili con Carne', items: [g1, g2] },
    ])
  })
})

describe('estimatePer100', () => {
  it('450 g mit 610 kcal → 135,55… kcal pro 100 g; unbekannt bleibt unbekannt', () => {
    const per100 = estimatePer100(payload())!
    expect(per100.kcal).toBeCloseTo(135.5556, 4)
    expect(per100.carbs).toBeNull()
  })

  it('Stück oder ohne Menge → nicht umrechenbar', () => {
    expect(estimatePer100(payload({ unit: 'Stück', amount: 1 }))).toBeNull()
    expect(estimatePer100(payload({ amount: null }))).toBeNull()
  })
})

describe('resolvePart', () => {
  it('Verweis auf Lebensmittel: Kcalms Werte (mit Korrektur), Menge aus dem Vorschlag', () => {
    const part = resolvePart(payload({ ref: { type: 'product', id: 'p2' }, amount: 200, unit: 'g', kcal: null }), resolve, findMeal)
    expect(part).toEqual({ kind: 'food', food: quarkKorrigiert, amount: 200 })
  })

  it('Verweis ohne Menge oder mit fremder Einheit: erste Portion', () => {
    expect(resolvePart(payload({ ref: { type: 'product', id: 'p1' }, amount: null, unit: null }), resolve, findMeal)).toMatchObject({ amount: 250 })
    expect(resolvePart(payload({ ref: { type: 'product', id: 'p1' }, amount: 1, unit: 'Becher' }), resolve, findMeal)).toMatchObject({ amount: 250 })
  })

  it('Verweis auf gelöschtes oder archiviertes Produkt nutzt die freien Werte', () => {
    const gone = resolvePart(payload({ ref: { type: 'product', id: 'weg' } }), resolve, findMeal)
    expect(gone).toMatchObject({ kind: 'estimate', name: 'Chili', amount: 450 })
    expect(resolvePart(payload({ ref: { type: 'product', id: 'p3' } }), resolve, findMeal)).toMatchObject({ kind: 'estimate' })
  })

  it('Verweis ohne Ersatzwerte → missing', () => {
    expect(resolvePart(payload({ ref: { type: 'product', id: 'weg' }, kcal: null }), resolve, findMeal)).toEqual({ kind: 'missing' })
  })

  it('Verweis auf Mahlzeit: Bestandteile, amount = Faktor', () => {
    const part = resolvePart(payload({ ref: { type: 'meal', id: meal.id }, amount: 2, unit: null, kcal: null }), resolve, findMeal)
    expect(part).toMatchObject({ kind: 'meal', meal, scale: 2 })
    expect(part.kind === 'meal' && part.lines[0]).toMatchObject({ ref: 'product:p1', on: true, amount: 250 })
  })

  it('freie Werte → Schätzung mit Nährwerten', () => {
    expect(resolvePart(payload(), resolve, findMeal)).toEqual({
      kind: 'estimate',
      name: 'Chili',
      amount: 450,
      unit: 'g',
      nutrients: { ...unknownNutrients(), kcal: 610, protein: 38, fat: 25, salt: 2.7 },
      per100: estimatePer100(payload()),
    })
  })
})

describe('scaleEstimate', () => {
  it('300 statt 450 g = zwei Drittel, null bleibt null', () => {
    const part = resolvePart(payload(), resolve, findMeal)
    if (part.kind !== 'estimate') throw new Error('erwartet Schätzung')
    const scaled = scaleEstimate(part, 300)
    expect(scaled.amount).toBe(300)
    expect(scaled.nutrients.kcal).toBeCloseTo(406.6667, 4)
    expect(scaled.nutrients.carbs).toBeNull()
  })
})

describe('estimateFood', () => {
  it('Schätzung in g als Lebensmittel für den Mengen-Schritt (nur zur Anzeige)', () => {
    const part = resolvePart(payload(), resolve, findMeal)
    if (part.kind !== 'estimate') throw new Error('erwartet Schätzung')
    expect(estimateFood(part)).toMatchObject({ name: 'Chili', source: ESTIMATE_SOURCE, verified: false, unit: 'g', portions: [] })
    expect(estimateFood(part)!.per100.kcal).toBeCloseTo(135.5556, 4)
  })

  it('ohne g/ml → null (Menge nicht änderbar)', () => {
    const part = resolvePart(payload({ unit: 'Stück', amount: 1 }), resolve, findMeal)
    if (part.kind !== 'estimate') throw new Error('erwartet Schätzung')
    expect(estimateFood(part)).toBeNull()
  })
})

describe('slotIdFor', () => {
  const slots = [
    newRecord<Slot>({ name: 'Frühstück', order: 1, timeFrom: null, timeTo: null, archived: false }),
    newRecord<Slot>({ name: 'Snack', order: 2, timeFrom: null, timeTo: null, archived: true }),
  ]
  it('gleicher Name ohne Groß/Klein', () => {
    expect(slotIdFor('frühstück', slots)).toBe(slots[0]!.id)
  })
  it('umbenannter, archivierter oder fehlender Slot → null', () => {
    expect(slotIdFor('Morgens', slots)).toBeNull()
    expect(slotIdFor('Snack', slots)).toBeNull()
    expect(slotIdFor(null, slots)).toBeNull()
  })
})

describe('suggestionEntries', () => {
  const group = { id: G, name: 'Chili con Carne' }

  it('Gruppe setzt mealGroupId und mealName; Schätzung als Schnelleintrag mit Menge und estimated', () => {
    const chili = resolvePart(payload(), resolve, findMeal)
    const q = resolvePart(payload({ ref: { type: 'product', id: 'p1' }, amount: 100, kcal: null }), resolve, findMeal)
    const entries = suggestionEntries([{ part: chili, slotId: 's1' }, { part: q, slotId: 's2' }], '2026-11-20', group)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      kind: 'quick',
      ref: null,
      nameSnapshot: 'Chili',
      amount: 450,
      unit: 'g',
      slotId: 's1',
      estimated: true,
      mealGroupId: G,
      mealName: 'Chili con Carne',
      nutrients: { kcal: 610, carbs: null },
    })
    expect(entries[1]).toMatchObject({ kind: 'food', ref: 'product:p1', amount: 100, slotId: 's2', estimated: false, mealGroupId: G })
    expect(entries[1]!.nutrients.kcal).toBeCloseTo(67)
  })

  it('Schätzung ohne g/ml: Werte wie geschickt, Menge leer', () => {
    const part = resolvePart(payload({ unit: 'Stück', amount: 1 }), resolve, findMeal)
    expect(suggestionEntries([{ part, slotId: 's1' }], '2026-11-20', null)[0]).toMatchObject({ amount: null, unit: null, nutrients: { kcal: 610 }, estimated: true })
  })

  it('Mahlzeit-Verweis in Gruppe wird in Bestandteile der Gruppe aufgelöst', () => {
    const part = resolvePart(payload({ ref: { type: 'meal', id: meal.id }, amount: null, unit: null, kcal: null }), resolve, findMeal)
    const [e] = suggestionEntries([{ part, slotId: 's1' }], '2026-11-20', group)
    expect(e).toMatchObject({ ref: 'product:p1', amount: 250, mealGroupId: G, mealName: 'Chili con Carne' })
  })

  it('Mahlzeit als Einzelvorschlag bekommt eine eigene Gruppe mit ihrem Namen', () => {
    const part = resolvePart(payload({ ref: { type: 'meal', id: meal.id }, amount: null, unit: null, kcal: null }), resolve, findMeal)
    const [e] = suggestionEntries([{ part, slotId: 's1' }], '2026-11-20', null, () => 'neue-gruppe')
    expect(e).toMatchObject({ mealGroupId: 'neue-gruppe', mealName: 'Quark-Frühstück' })
  })

  it('missing wird übersprungen', () => {
    expect(suggestionEntries([{ part: { kind: 'missing' }, slotId: 's1' }], '2026-11-20', null)).toEqual([])
  })
})

describe('bestMatch', () => {
  const reis = food('bls:C1', 'Reis, gekocht', 130)
  const teig = food('bls:C2', 'Pizzateig', 250)
  const index = createSearchIndex([reis, teig], (f) => f.name)

  it('„Reis gekocht“ findet „Reis, gekocht“', () => {
    expect(bestMatch('Reis gekocht', index, (f) => f.name)).toBe(reis)
  })

  it('„Pizza“ findet „Pizzateig“ nicht (ganze Wörter)', () => {
    expect(bestMatch('Pizza', index, (f) => f.name)).toBeNull()
  })
})

describe('suggestionCountLabel', () => {
  it('Einzahl und Mehrzahl', () => {
    expect(suggestionCountLabel(1)).toBe('1 Vorschlag aus Fitboard')
    expect(suggestionCountLabel(3)).toBe('3 Vorschläge aus Fitboard')
  })
})
