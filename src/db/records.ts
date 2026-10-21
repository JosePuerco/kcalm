// Reine Hilfsfunktionen für sync-fähige Datensätze. Kein Datenbankzugriff, damit testbar.

import type { NutrientKey, Nutrients, SyncFields } from './types.ts'

export const NUTRIENT_KEYS: readonly NutrientKey[] = [
  'kcal',
  'fat',
  'satFat',
  'carbs',
  'sugar',
  'fiber',
  'protein',
  'salt',
  'water',
]

/** Alle Nährwerte unbekannt (null), nicht 0 */
export function unknownNutrients(): Nutrients {
  return {
    kcal: null,
    fat: null,
    satFat: null,
    carbs: null,
    sugar: null,
    fiber: null,
    protein: null,
    salt: null,
    water: null,
  }
}

type NewFields<T extends SyncFields> = Omit<T, keyof SyncFields>

/** Neuer Datensatz mit UUID und Zeitstempeln */
export function newRecord<T extends SyncFields>(fields: NewFields<T>, now = new Date()): T {
  const stamp = now.toISOString()
  return { ...fields, id: crypto.randomUUID(), createdAt: stamp, updatedAt: stamp, deletedAt: null } as T
}

/** Änderungen übernehmen und updatedAt setzen; id und createdAt bleiben */
export function touch<T extends SyncFields>(record: T, changes: Partial<NewFields<T>> = {}, now = new Date()): T {
  return { ...record, ...changes, updatedAt: now.toISOString() }
}

/** Löschmarker setzen statt echt löschen */
export function softDelete<T extends SyncFields>(record: T, now = new Date()): T {
  const stamp = now.toISOString()
  return { ...record, deletedAt: stamp, updatedAt: stamp }
}

/**
 * Für Tabellen mit eindeutigem Schlüssel (productOverrides, blsPrefs, days, settings):
 * Gibt es schon einen Datensatz (auch gelöscht), wird er wiederbelebt statt ein zweiter angelegt.
 */
export function upsertByKey<T extends SyncFields>(
  existing: T | undefined,
  fields: NewFields<T>,
  now = new Date(),
): T {
  if (!existing) return newRecord<T>(fields, now)
  return { ...touch(existing, fields as Partial<NewFields<T>>, now), deletedAt: null }
}

export function isActive(record: SyncFields): boolean {
  return record.deletedAt === null
}
