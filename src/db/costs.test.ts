import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import { loadCostStats } from './costs.ts'
import { db } from './db.ts'
import { createProduct, saveBlsPrice, saveProductPrice } from './products.ts'
import { newRecord, softDelete, unknownNutrients } from './records.ts'
import type { Day, Entry, FoodRef } from './types.ts'

const today = '2026-10-21' // Mittwoch

function entry(date: string, fields: Partial<Entry>) {
  return newRecord<Entry>({
    date,
    slotId: 's',
    kind: 'food',
    ref: null,
    nameSnapshot: 'Test',
    amount: null,
    unit: 'g',
    portionLabel: null,
    nutrients: { ...unknownNutrients(), kcal: 100 },
    mealGroupId: null,
    mealName: null,
    cost: null,
    ...fields,
  })
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('loadCostStats', () => {
  it('Kosten aus aktuellen Preisen, nur Einträge des Zeitraums, gelöschte nicht', async () => {
    const hafer = await createProduct({
      name: 'Hafer',
      brand: null,
      barcode: null,
      unit: 'g',
      per100: { ...unknownNutrients(), kcal: 372 },
      portions: [],
    })
    await saveProductPrice(hafer.id, { amount: 1, per: 500 })
    await saveBlsPrice('M111300', { amount: 1.2, per: 1000 })
    const ref: FoodRef = `product:${hafer.id}`
    await db.entries.bulkAdd([
      entry('2026-10-18', { kind: 'quick', cost: 99 }), // Vorwoche
      entry('2026-10-19', { ref, amount: 100 }), // 0,20 €
      entry('2026-10-19', { ref: 'bls:M111300', amount: 500 }), // 0,60 €
      entry('2026-10-20', { kind: 'quick', ref: null, cost: 12 }),
      softDelete(entry('2026-10-20', { kind: 'quick', ref: null, cost: 50 })),
      entry('2026-10-20', { ref: 'bls:ohnePreis', amount: 100 }),
    ])
    await db.days.add(newRecord<Day>({ date: '2026-10-19', complete: true }))

    const s = await loadCostStats(today, 'week')
    expect(s.range).toBe('week')
    expect(s.tiles.avgPerDay?.value).toBeCloseTo(0.8, 10)
    expect(s.tiles.total.value).toBeCloseTo(12.8, 10)
    expect(s.tiles.total.atLeast).toBe(true)
    expect(s.withoutPrice).toBe(1)
    expect(s.top[0]).toMatchObject({ key: 'quick', cost: 12 })
  })

  it('neuer Preis gilt rückwirkend', async () => {
    const p = await createProduct({ name: 'Skyr', brand: null, barcode: null, unit: 'g', per100: unknownNutrients(), portions: [] })
    await db.entries.add(entry('2026-10-19', { ref: `product:${p.id}`, amount: 450 }))
    expect((await loadCostStats(today, 'week')).tiles.total).toEqual({ value: null, atLeast: false })
    await saveProductPrice(p.id, { amount: 1.49, per: 450 })
    expect((await loadCostStats(today, 'week')).tiles.total.value).toBeCloseTo(1.49, 10)
  })
})
