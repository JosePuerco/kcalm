// Versionen der lokalen Datenbank. Eine Version mit upgrade() läuft beim ersten Öffnen nach
// einem App-Update genau einmal. Eigene Datei, damit Tests eine alte Datenbank hochziehen können.

import type { Dexie } from 'dexie'
import { addBlsUseOverride, NUTRIENT_FIELDS, removeAlcohol } from '../logic/backup.ts'
import { SCHEMA_V1 } from './schema.ts'

export function defineVersions(db: Dexie): void {
  db.version(1).stores(SCHEMA_V1)

  // Nährwert „alcohol“ entfällt (Jan, 21.10.2026). updatedAt bleibt: keine Änderung durch den Nutzer.
  db.version(2)
    .stores(SCHEMA_V1)
    .upgrade(async (tx) => {
      for (const [table, field] of Object.entries(NUTRIENT_FIELDS)) {
        await tx
          .table(table)
          .toCollection()
          .modify((record: unknown) => removeAlcohol(record, field))
      }
    })

  // Umschalter Meine/Original für BLS (Jan, 21.10.2026); bisher galt immer die Korrektur
  db.version(3)
    .stores(SCHEMA_V1)
    .upgrade(async (tx) => {
      await tx
        .table('blsPrefs')
        .toCollection()
        .modify((record: unknown) => addBlsUseOverride(record))
    })
}
