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

/**
 * Sync-fähige Tabellen ab Datenbank-Version 8 (Phase 16): dazu Jans Entscheidungen zu Vorschlägen.
 * SCHEMA_V1 bleibt für die älteren Versionen unverändert.
 */
export const SCHEMA_SYNC = {
  ...SCHEMA_V1,
  inboxDecisions: 'id, updatedAt',
} as const

export type TableName = keyof typeof SCHEMA_SYNC

/** Abgeholte Vorschläge aus Fitboard (Phase 16), nur lokal: nicht sync-fähig, nicht im Backup, nicht im Push */
export const SCHEMA_INBOX = {
  inbox: 'id, date',
} as const

/**
 * Quittungsliste für den Push (Phase 14, Datenbank-Version 7). Bewusst nicht in SCHEMA_V1:
 * kein sync-fähiger Datensatz, nicht im Backup, nicht übertragen. Schlüssel = Tabelle + id.
 */
export const SCHEMA_PUSH = {
  pushState: '[table+id]',
} as const
