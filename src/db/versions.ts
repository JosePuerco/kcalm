// Versionen der lokalen Datenbank. Eine Version mit upgrade() läuft beim ersten Öffnen nach
// einem App-Update genau einmal. Eigene Datei, damit Tests eine alte Datenbank hochziehen können.

import type { Dexie } from 'dexie'
import {
  addBlsUseOverride,
  addOverrideUnit,
  NUTRIENT_FIELDS,
  removeAlcohol,
  removeWater,
  WATER_SETTING_KEY,
} from '../logic/backup.ts'
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

  // Wasser-Tracking entfällt (Jan, 22.10.2026). Felder entfernen ohne updatedAt (wie bei alcohol);
  // die Einstellung bekommt einen Löschmarker, damit ein späterer Abgleich das Löschen mitbekommt.
  db.version(4)
    .stores(SCHEMA_V1)
    .upgrade(async (tx) => {
      for (const table of ['products', 'productOverrides', 'blsPrefs', 'entries', 'profileVersions']) {
        await tx
          .table(table)
          .toCollection()
          .modify((record: unknown) => removeWater(table, record))
      }
      const stamp = new Date().toISOString()
      await tx
        .table('settings')
        .where('key')
        .equals(WATER_SETTING_KEY)
        .modify((record: { deletedAt: string | null; updatedAt: string }) => {
          if (record.deletedAt !== null) return
          record.deletedAt = stamp
          record.updatedAt = stamp
        })
    })

  // Einheit g/ml in der Korrekturschicht (Jan, 27.10.2026); null = Original gilt, updatedAt bleibt
  db.version(5)
    .stores(SCHEMA_V1)
    .upgrade(async (tx) => {
      await tx
        .table('productOverrides')
        .toCollection()
        .modify((record: unknown) => addOverrideUnit(record))
    })
}
