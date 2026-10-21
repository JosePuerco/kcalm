// Mahlzeiten-Vorlagen speichern. Löschen = Löschmarker; Tagebucheinträge tragen Werte und Namen selbst,
// deshalb darf eine Vorlage immer gelöscht werden.

import type { MealFormData } from '../logic/meal.ts'
import { db } from './db.ts'
import { newRecord, softDelete, touch } from './records.ts'
import type { Meal } from './types.ts'

export async function createMeal(data: MealFormData, now = new Date()): Promise<Meal> {
  const meal = newRecord<Meal>({ ...data, archived: false }, now)
  await db.meals.add(meal)
  return meal
}

export async function getMeal(id: string): Promise<Meal> {
  const meal = await db.meals.get(id)
  if (!meal || meal.deletedAt !== null) throw new Error(`Mahlzeit ${id} nicht gefunden`)
  return meal
}

export async function updateMeal(id: string, data: MealFormData, now = new Date()): Promise<Meal> {
  return db.transaction('rw', db.meals, async () => {
    const updated = touch(await getMeal(id), data, now)
    await db.meals.put(updated)
    return updated
  })
}

async function setArchived(id: string, archived: boolean, now: Date) {
  await db.transaction('rw', db.meals, async () => {
    await db.meals.put(touch(await getMeal(id), { archived }, now))
  })
}

export const archiveMeal = (id: string, now = new Date()) => setArchived(id, true, now)
export const restoreMeal = (id: string, now = new Date()) => setArchived(id, false, now)

export async function deleteMeal(id: string, now = new Date()): Promise<void> {
  await db.transaction('rw', db.meals, async () => {
    await db.meals.put(softDelete(await getMeal(id), now))
  })
}
