// Backup lesen und einspielen. Ersetzen und Zusammenführen laufen in einer Transaktion:
// Entweder alles klappt, oder die Datenbank bleibt unverändert.

import {
  buildBackup,
  lastBackupAfterImport,
  mergeTables,
  TABLE_NAMES,
  type Backup,
  type BackupTables,
} from '../logic/backup.ts'
import type { TableName } from './schema.ts'
import { db } from './db.ts'
import { getSetting, setSetting } from './settings.ts'
import type { SyncFields, Timestamp } from './types.ts'

/** Einstellung: Zeitpunkt des letzten erfolgreichen Backups (ISO) */
export const LAST_BACKUP_KEY = 'lastBackupAt'

function table(name: TableName) {
  return db.table<SyncFields, string>(name)
}

const allTables = () => TABLE_NAMES.map(table)

/** Alle Tabellen vollständig, inkl. gelöschter Datensätze */
export async function readAllTables(): Promise<BackupTables> {
  return db.transaction('r', allTables(), async () => {
    const entries = await Promise.all(TABLE_NAMES.map(async (name) => [name, await table(name).toArray()] as const))
    return Object.fromEntries(entries) as unknown as BackupTables
  })
}

export async function createBackup(now = new Date()): Promise<Backup> {
  return buildBackup(await readAllTables(), now)
}

export async function getLastBackupAt(): Promise<Timestamp | null> {
  return (await getSetting<Timestamp>(LAST_BACKUP_KEY)) ?? null
}

export async function markBackedUp(now = new Date()): Promise<void> {
  await setSetting(LAST_BACKUP_KEY, now.toISOString(), now)
}

/** Löscht alle Daten auf dem Gerät und spielt das Backup ein */
export async function replaceWithBackup(backup: Backup, now = new Date()): Promise<void> {
  await db.transaction('rw', allTables(), async () => {
    const lastBackup = await getLastBackupAt()
    for (const name of TABLE_NAMES) {
      await table(name).clear()
      await table(name).bulkAdd(backup.tables[name] as SyncFields[])
    }
    await setSetting(LAST_BACKUP_KEY, lastBackupAfterImport(lastBackup, backup.exportedAt), now)
  })
}

/** Pro id (bzw. eindeutigem Schlüssel) gewinnt der neuere Stand; liefert die Anzahl neuer und geänderter Datensätze */
export async function mergeBackup(backup: Backup, now = new Date()): Promise<{ added: number; updated: number }> {
  return db.transaction('rw', allTables(), async () => {
    const lastBackup = await getLastBackupAt()
    const plan = mergeTables(await readAllTables(), backup.tables)
    for (const name of TABLE_NAMES) {
      await table(name).bulkDelete(plan.remove[name])
      await table(name).bulkPut(plan.put[name] as SyncFields[])
    }
    await setSetting(LAST_BACKUP_KEY, lastBackupAfterImport(lastBackup, backup.exportedAt), now)
    return { added: plan.added, updated: plan.updated }
  })
}
