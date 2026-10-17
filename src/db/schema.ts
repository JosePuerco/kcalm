// Indizes der Datenbank, getrennt von Dexie, damit Tests sie ohne IndexedDB prüfen können.

/** & = eindeutig, [a+b] = zusammengesetzter Index */
export const SCHEMA_V1 = {
  products: 'id, barcode, source, updatedAt',
  productOverrides: 'id, &productRef, updatedAt',
  blsPrefs: 'id, &blsCode, updatedAt',
  meals: 'id, updatedAt',
  recipes: 'id, updatedAt',
  slots: 'id, order, updatedAt',
  entries: 'id, date, [date+slotId], ref, mealGroupId, updatedAt',
  days: 'id, &date, updatedAt',
  profiles: 'id, updatedAt',
  profileVersions: 'id, profileId, updatedAt',
  profileAssignments: 'id, validFrom, updatedAt',
  weights: 'id, date, updatedAt',
  pendingScans: 'id, barcode, updatedAt',
  settings: 'id, &key, updatedAt',
} as const

export type TableName = keyof typeof SCHEMA_V1
