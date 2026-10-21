import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import type { MealFormData } from '../logic/meal.ts'
import { db } from './db.ts'
import { archiveMeal, createMeal, deleteMeal, getMeal, restoreMeal, updateMeal } from './meals.ts'

const t0 = new Date('2026-10-21T08:00:00.000Z')
const t1 = new Date('2026-10-22T08:00:00.000Z')

const data: MealFormData = {
  name: 'Frühstück-Klassiker',
  items: [
    { ref: 'bls:hafer', amount: 60, unit: 'g', portionLabel: null },
    { ref: 'product:milch', amount: 250, unit: 'ml', portionLabel: null },
  ],
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('Mahlzeiten', () => {
  it('legt an mit Sync-Feldern, nicht archiviert', async () => {
    const m = await createMeal(data, t0)
    expect(await getMeal(m.id)).toEqual(m)
    expect(m).toMatchObject({ ...data, archived: false, createdAt: t0.toISOString(), deletedAt: null })
  })

  it('ändern setzt updatedAt, id und createdAt bleiben', async () => {
    const m = await createMeal(data, t0)
    const u = await updateMeal(m.id, { ...data, name: 'Neu' }, t1)
    expect(u).toMatchObject({ id: m.id, name: 'Neu', createdAt: t0.toISOString(), updatedAt: t1.toISOString() })
  })

  it('archivieren und zurückholen', async () => {
    const m = await createMeal(data, t0)
    await archiveMeal(m.id, t1)
    expect((await getMeal(m.id)).archived).toBe(true)
    await restoreMeal(m.id, t1)
    expect((await getMeal(m.id)).archived).toBe(false)
  })

  it('löschen setzt den Löschmarker; danach nicht mehr auffindbar', async () => {
    const m = await createMeal(data, t0)
    await deleteMeal(m.id, t1)
    expect((await db.meals.get(m.id))?.deletedAt).toBe(t1.toISOString())
    await expect(getMeal(m.id)).rejects.toThrow()
    await expect(updateMeal(m.id, data, t1)).rejects.toThrow()
  })
})
