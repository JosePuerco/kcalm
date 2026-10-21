// Rezepte speichern. Pro 100 g wird immer aus den Zutaten berechnet, nicht gespeichert.
// Löschen = Löschmarker; verwendete Rezepte (Tagebuch, Mahlzeit) werden nur archiviert, wie Produkte.

import type { RecipeFormData } from '../logic/recipe.ts'
import { db } from './db.ts'
import { isFoodUsed } from './products.ts'
import { newRecord, softDelete, touch } from './records.ts'
import type { Recipe } from './types.ts'

export async function createRecipe(data: RecipeFormData, now = new Date()): Promise<Recipe> {
  const recipe = newRecord<Recipe>({ ...data, archived: false }, now)
  await db.recipes.add(recipe)
  return recipe
}

export async function getRecipe(id: string): Promise<Recipe> {
  const recipe = await db.recipes.get(id)
  if (!recipe || recipe.deletedAt !== null) throw new Error(`Rezept ${id} nicht gefunden`)
  return recipe
}

/** Gilt nur für künftige Einträge: alte Einträge haben ihre Werte als Snapshot */
export async function updateRecipe(id: string, data: RecipeFormData, now = new Date()): Promise<Recipe> {
  return db.transaction('rw', db.recipes, async () => {
    const updated = touch(await getRecipe(id), data, now)
    await db.recipes.put(updated)
    return updated
  })
}

async function setArchived(id: string, archived: boolean, now: Date) {
  await db.transaction('rw', db.recipes, async () => {
    await db.recipes.put(touch(await getRecipe(id), { archived }, now))
  })
}

export const archiveRecipe = (id: string, now = new Date()) => setArchived(id, true, now)
export const restoreRecipe = (id: string, now = new Date()) => setArchived(id, false, now)

/** Nur für unbenutzte Rezepte; sonst archivieren */
export async function deleteRecipe(id: string, now = new Date()): Promise<void> {
  await db.transaction('rw', [db.recipes, db.entries, db.meals], async () => {
    if (await isFoodUsed(`recipe:${id}`)) throw new Error('Rezept wird verwendet, bitte archivieren')
    await db.recipes.put(softDelete(await getRecipe(id), now))
  })
}
