// Einheit g/ml nachträglich umbenennen (Jan, 27.10.2026): Wechselt die Einheit eines Lebensmittels,
// bekommen auch alte Tagebucheinträge und Mahlzeiten-Bestandteile die neue Einheit, damit alles einheitlich
// ist. Nur die Bezeichnung: Menge und Nährwerte bleiben, es wird nichts umgerechnet.

import { relabelMealItems } from '../logic/meal.ts'
import { db } from './db.ts'
import { touch } from './records.ts'
import type { FoodRef, Unit } from './types.ts'

/** Muss in einer Transaktion mit entries und meals laufen */
export async function relabelUnit(ref: FoodRef, unit: Unit, now: Date): Promise<void> {
  const entries = await db.entries
    .where('ref')
    .equals(ref)
    .filter((e) => e.deletedAt === null && e.unit !== null && e.unit !== unit)
    .toArray()
  await db.entries.bulkPut(entries.map((e) => touch(e, { unit }, now)))
  const meals = await db.meals.filter((m) => m.deletedAt === null).toArray()
  const changed = meals.flatMap((m) => {
    const items = relabelMealItems(m.items, ref, unit)
    return items ? [touch(m, { items }, now)] : []
  })
  await db.meals.bulkPut(changed)
}
