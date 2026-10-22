import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import type { RecipeFormData } from '../logic/recipe.ts'
import { db } from './db.ts'
import { createMeal } from './meals.ts'
import { newRecord, unknownNutrients } from './records.ts'
import { archiveRecipe, createRecipe, deleteRecipe, getRecipe, restoreRecipe, updateRecipe } from './recipes.ts'
import type { Entry } from './types.ts'

const t0 = new Date('2026-10-21T08:00:00.000Z')
const t1 = new Date('2026-10-22T08:00:00.000Z')

const data: RecipeFormData = {
  name: 'Chili con Carne',
  ingredients: [
    { ref: 'bls:hack', amount: 500 },
    { ref: 'bls:bohnen', amount: 250 },
  ],
  finalWeightG: 1400,
  portions: [{ label: '1 Teller', amount: 450 }],
}

function entryFor(ref: Entry['ref']) {
  return newRecord<Entry>({
    date: '2026-10-21',
    slotId: 'slot',
    kind: 'food',
    ref,
    nameSnapshot: 'Chili',
    amount: 450,
    unit: 'g',
    portionLabel: '1 Teller',
    nutrients: { ...unknownNutrients(), kcal: 608 },
    mealGroupId: null,
    mealName: null,
  })
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('Rezepte', () => {
  it('legt an mit Sync-Feldern, nicht archiviert', async () => {
    const r = await createRecipe(data, t0)
    expect(await getRecipe(r.id)).toEqual(r)
    expect(r).toMatchObject({ ...data, archived: false, createdAt: t0.toISOString(), deletedAt: null })
  })

  it('ändern gilt nur für künftige Einträge: alter Snapshot bleibt', async () => {
    const r = await createRecipe(data, t0)
    const e = entryFor(`recipe:${r.id}`)
    await db.entries.add(e)
    await updateRecipe(r.id, { ...data, finalWeightG: 1000 }, t1)
    expect((await getRecipe(r.id)).finalWeightG).toBe(1000)
    expect((await db.entries.get(e.id))?.nutrients.kcal).toBe(608)
  })

  it('archivieren und zurückholen', async () => {
    const r = await createRecipe(data, t0)
    await archiveRecipe(r.id, t1)
    expect((await getRecipe(r.id)).archived).toBe(true)
    await restoreRecipe(r.id, t1)
    expect((await getRecipe(r.id)).archived).toBe(false)
  })

  it('unbenutzt: löschen setzt den Löschmarker', async () => {
    const r = await createRecipe(data, t0)
    await deleteRecipe(r.id, t1)
    expect((await db.recipes.get(r.id))?.deletedAt).toBe(t1.toISOString())
    await expect(getRecipe(r.id)).rejects.toThrow()
  })

  it('im Tagebuch verwendet: löschen verweigert', async () => {
    const r = await createRecipe(data, t0)
    await db.entries.add(entryFor(`recipe:${r.id}`))
    await expect(deleteRecipe(r.id, t1)).rejects.toThrow('archivieren')
    expect((await getRecipe(r.id)).deletedAt).toBeNull()
  })

  it('in einer Mahlzeit verwendet: löschen verweigert', async () => {
    const r = await createRecipe(data, t0)
    await createMeal({
      name: 'Chili mit Reis',
      items: [{ ref: `recipe:${r.id}`, amount: 450, unit: 'g', portionLabel: null }],
    })
    await expect(deleteRecipe(r.id, t1)).rejects.toThrow('archivieren')
  })

  it('Eintrag gelöscht → Rezept wieder löschbar', async () => {
    const r = await createRecipe(data, t0)
    const e = entryFor(`recipe:${r.id}`)
    await db.entries.add({ ...e, deletedAt: t0.toISOString() })
    await deleteRecipe(r.id, t1)
    expect((await db.recipes.get(r.id))?.deletedAt).toBe(t1.toISOString())
  })
})
