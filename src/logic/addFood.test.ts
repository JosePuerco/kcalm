import { describe, expect, it } from 'vitest'
import { newRecord, unknownNutrients } from '../db/records.ts'
import type { BlsPref, Entry, Product, ProductOverride } from '../db/types.ts'
import {
  addedMessage,
  amountToKeypad,
  canEditAsFood,
  choiceFromBls,
  choiceFromEntry,
  editedEntry,
  choiceFromProduct,
  foodEntry,
  initialAmount,
  per100Label,
  portionChipLabel,
  portionLabelFor,
  recentRefs,
} from './addFood.ts'
import { mergeNutrients } from './verify.ts'

const skyr: Product = newRecord<Product>({
  source: 'off',
  barcode: null,
  name: 'Skyr natur',
  brand: 'Arla',
  unit: 'g',
  per100: { ...unknownNutrients(), kcal: 63, protein: 11, carbs: 4, fat: 0.2, fiber: 0 },
  portions: [
    { label: '1 Becher', amount: 250 },
    { label: '150 g', amount: 150 },
  ],
  isDrink: false,
  countsAsWater: false,
  useOverride: true,
  archived: false,
  offFetchedAt: null,
})

const override = (fields: Partial<ProductOverride>) =>
  newRecord<ProductOverride>({ productRef: `product:${skyr.id}`, per100: {}, verifiedAt: null, note: null, ...fields })

describe('choiceFromProduct / choiceFromBls', () => {
  it('Produkt mit Quelle, Portionen, Einheit', () => {
    const c = choiceFromProduct(skyr)
    expect(c).toMatchObject({ ref: `product:${skyr.id}`, name: 'Skyr natur', source: 'Open Food Facts', unit: 'g', verified: false })
    expect(c.portions).toHaveLength(2)
  })

  it('Korrekturschicht: nur geänderte Felder, null = bewusst unbekannt', () => {
    const o = override({ per100: { kcal: 65, salt: null }, verifiedAt: '2026-10-20T08:00:00.000Z' })
    const c = choiceFromProduct(skyr, o)
    expect(c.per100.kcal).toBe(65)
    expect(c.per100.protein).toBe(11)
    expect(c.verified).toBe(true)
  })

  it('useOverride aus: Original-Werte, aber trotzdem geprüft', () => {
    const o = override({ per100: { kcal: 65 }, verifiedAt: '2026-10-20T08:00:00.000Z' })
    const c = choiceFromProduct({ ...skyr, useOverride: false }, o)
    expect(c.per100.kcal).toBe(63)
    expect(c.verified).toBe(true)
  })

  it('gelöschte Korrektur zählt nicht', () => {
    const o = { ...override({ per100: { kcal: 99 } }), deletedAt: '2026-10-21T00:00:00.000Z' }
    expect(mergeNutrients(skyr.per100, o).kcal).toBe(63)
    expect(choiceFromProduct(skyr, o).verified).toBe(false)
  })

  it('eigene Produkte gelten als geprüft', () => {
    expect(choiceFromProduct({ ...skyr, source: 'own' }).verified).toBe(true)
  })

  it('BLS: Gramm, eigene Portionen aus blsPrefs', () => {
    const food = { code: 'F110100', name: 'Apfel roh', per100: { ...unknownNutrients(), kcal: 54 } }
    const pref = newRecord<BlsPref>({ blsCode: 'F110100', portions: [{ label: '1 Stück', amount: 150 }], isDrink: null, countsAsWater: null, useOverride: true })
    expect(choiceFromBls(food, pref)).toMatchObject({ ref: 'bls:F110100', source: 'BLS', unit: 'g', portions: [{ amount: 150 }] })
    expect(choiceFromBls(food).portions).toEqual([])
  })
})

describe('recentRefs', () => {
  const e = (ref: Entry['ref'], createdAt: string, kind: Entry['kind'] = 'food'): Entry => ({
    ...newRecord<Entry>({
      date: '2026-10-21',
      slotId: 's',
      kind,
      ref,
      nameSnapshot: 'x',
      amount: 1,
      unit: 'g',
      portionLabel: null,
      nutrients: unknownNutrients(),
      waterMl: 0,
      mealGroupId: null,
      mealName: null,
    }),
    createdAt,
  })

  it('neueste zuerst, jedes einmal, ohne Schnelleinträge und gelöschte', () => {
    const list = [
      e('product:a', '2026-10-20T08:00:00Z'),
      e('bls:b', '2026-10-21T08:00:00Z'),
      e('product:a', '2026-10-21T12:00:00Z'),
      e(null, '2026-10-21T13:00:00Z', 'quick'),
      { ...e('product:c', '2026-10-21T14:00:00Z'), deletedAt: '2026-10-21T15:00:00Z' },
    ]
    expect(recentRefs(list)).toEqual(['product:a', 'bls:b'])
  })

  it('Grenze', () => {
    const list = Array.from({ length: 30 }, (_, i) => e(`product:${i}`, `2026-10-21T08:${String(i).padStart(2, '0')}:00Z`))
    expect(recentRefs(list, 3)).toEqual(['product:29', 'product:28', 'product:27'])
  })
})

describe('Mengen-Schritt', () => {
  const c = choiceFromProduct(skyr)

  it('Startmenge: erste Portion, sonst 100', () => {
    expect(initialAmount(c)).toBe(250)
    expect(initialAmount({ ...c, portions: [] })).toBe(100)
  })

  it('amountToKeypad mit Dezimalkomma', () => {
    expect(amountToKeypad(250)).toBe('250')
    expect(amountToKeypad(12.5)).toBe('12,5')
  })

  it('Portions-Chips wie im Prototyp', () => {
    expect(portionChipLabel({ label: '1 Becher', amount: 250 }, 'g')).toBe('1 Becher · 250 g')
    expect(portionChipLabel({ label: '40 g', amount: 40 }, 'g')).toBe('40 g')
    expect(portionChipLabel({ label: '1 Glas', amount: 250 }, 'ml')).toBe('1 Glas · 250 ml')
  })

  it('Portionsname nur bei genau passender Menge', () => {
    expect(portionLabelFor(c, 250)).toBe('1 Becher')
    expect(portionLabelFor(c, 251)).toBeNull()
  })

  it('per100Label', () => {
    expect(per100Label(c)).toBe('63 kcal/100 g')
  })
})

describe('foodEntry', () => {
  const c = choiceFromProduct(skyr)

  it('Snapshot mit absoluten Werten, unbekannt bleibt unbekannt', () => {
    const e = foodEntry(c, 250, '2026-10-21', 'snacks')
    expect(e).toMatchObject({
      date: '2026-10-21',
      slotId: 'snacks',
      kind: 'food',
      ref: c.ref,
      nameSnapshot: 'Skyr natur',
      amount: 250,
      unit: 'g',
      portionLabel: '1 Becher',
      mealGroupId: null,
    })
    expect(e.nutrients.kcal).toBe(157.5)
    expect(e.nutrients.protein).toBe(27.5)
    expect(e.nutrients.salt).toBeNull()
  })

  it('Snapshot ist unabhängig vom Produkt', () => {
    const per100 = { ...c.per100 }
    const e = foodEntry({ ...c, per100 }, 100, '2026-10-21', 's')
    per100.kcal = 999
    expect(e.nutrients.kcal).toBe(63)
  })

  it('Menge muss positiv sein', () => {
    expect(() => foodEntry(c, 0, '2026-10-21', 's')).toThrow(RangeError)
    expect(() => foodEntry(c, Number.NaN, '2026-10-21', 's')).toThrow(RangeError)
  })

  it('Toast-Text wie im Prototyp', () => {
    expect(addedMessage('Skyr natur', 157.5, 'Snacks')).toBe('Skyr natur · 158 kcal zu Snacks')
    expect(addedMessage('Apfel', null, 'Snacks')).toBe('Apfel · – kcal zu Snacks')
  })
})

describe('Bearbeiten', () => {
  const c = choiceFromProduct(skyr)
  const stored: Entry = { ...newRecord<Entry>(foodEntry(c, 250, '2026-10-21', 'snacks')) }

  it('Werte pro 100 aus dem Snapshot, auch wenn sich das Produkt inzwischen geändert hat', () => {
    const changed = { ...c, per100: { ...c.per100, kcal: 999 } }
    const food = choiceFromEntry(stored, changed)
    expect(food.per100.kcal).toBeCloseTo(63, 10)
    expect(food.per100.salt).toBeNull()
    expect(food.portions).toEqual(c.portions)
    expect(food.name).toBe('Skyr natur')
  })

  it('Menge ändern skaliert den Snapshot', () => {
    const food = choiceFromEntry(stored)
    const e = editedEntry(food, 150, '2026-10-21', 'snacks')
    expect(e.nutrients.kcal).toBeCloseTo(94.5, 10)
    expect(e.nutrients.protein).toBeCloseTo(16.5, 10)
    expect(e.portionLabel).toBeNull() // ohne aktuelles Produkt keine Portionen bekannt
  })

  it('Verschieben: anderer Tag und Slot, Werte bleiben', () => {
    const e = editedEntry(choiceFromEntry(stored, c), 250, '2026-10-20', 'abend')
    expect(e).toMatchObject({ date: '2026-10-20', slotId: 'abend', amount: 250, portionLabel: '1 Becher' })
    expect(e.nutrients.kcal).toBeCloseTo(157.5, 10)
  })

  it('canEditAsFood: nur Lebensmittel mit Verweis und Menge', () => {
    expect(canEditAsFood(stored)).toBe(true)
    expect(canEditAsFood({ ...stored, ref: null })).toBe(false)
    expect(canEditAsFood({ ...stored, amount: 0 })).toBe(false)
    expect(canEditAsFood({ ...stored, kind: 'quick' })).toBe(false)
  })

  it('Schnelleinträge gehen hier nicht', () => {
    expect(() => choiceFromEntry({ ...stored, kind: 'quick', amount: null, unit: null, ref: null })).toThrow(RangeError)
  })
})
