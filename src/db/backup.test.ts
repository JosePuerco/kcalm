import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import { parseBackup, serializeBackup } from '../logic/backup.ts'
import { createBackup, getLastBackupAt, markBackedUp, mergeBackup, readAllTables, replaceWithBackup } from './backup.ts'
import { db } from './db.ts'
import { createProduct } from './products.ts'
import { newRecord, unknownNutrients } from './records.ts'
import { getSetting, setSetting } from './settings.ts'
import type { Day } from './types.ts'

const t0 = new Date('2026-10-17T08:00:00.000Z')
const t1 = new Date('2026-10-18T08:00:00.000Z')
const t2 = new Date('2026-10-19T08:00:00.000Z')

const skyr = {
  name: 'Skyr natur',
  brand: 'Arla',
  barcode: null,
  unit: 'g' as const,
  per100: { ...unknownNutrients(), kcal: 63, protein: 11 },
  portions: [{ label: '1 Becher', amount: 150 }],
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

/** Backup wie über eine Datei: serialisieren und wieder einlesen */
async function roundTrip(now: Date) {
  const result = parseBackup(serializeBackup(await createBackup(now)))
  if (!result.ok) throw new Error(result.error)
  return result.backup
}

describe('createBackup', () => {
  it('enthält alle Tabellen inkl. gelöschter Datensätze', async () => {
    const p = await createProduct(skyr, t0)
    await db.products.update(p.id, { deletedAt: t1.toISOString(), updatedAt: t1.toISOString() })
    await setSetting('theme', 'dark', t0)
    const backup = await createBackup(t2)
    expect(backup.tables.products).toHaveLength(1)
    expect(backup.tables.products[0]?.deletedAt).toBe(t1.toISOString())
    expect(backup.tables.settings.map((s) => s.key)).toEqual(['theme'])
    expect(backup.tables.entries).toEqual([])
  })
})

describe('markBackedUp / getLastBackupAt', () => {
  it('speichert den Zeitpunkt', async () => {
    expect(await getLastBackupAt()).toBeNull()
    await markBackedUp(t1)
    expect(await getLastBackupAt()).toBe(t1.toISOString())
  })
})

describe('replaceWithBackup', () => {
  it('Daten anlegen → sichern → alles löschen → einspielen ergibt denselben Stand', async () => {
    await createProduct(skyr, t0)
    await db.days.add(newRecord<Day>({ date: '2026-10-17', complete: true }, t0))
    await setSetting('theme', 'dark', t0)
    const before = await readAllTables()
    const backup = await roundTrip(t1)

    await Promise.all(db.tables.map((t) => t.clear()))
    await replaceWithBackup(backup, t2)

    const after = await readAllTables()
    expect(after.products).toEqual(before.products)
    expect(after.days).toEqual(before.days)
    expect(await getSetting('theme')).toBe('dark')
    expect(await getLastBackupAt()).toBe(t1.toISOString())
  })

  it('entfernt lokale Daten, die nicht im Backup sind', async () => {
    const backup = await roundTrip(t0)
    await createProduct(skyr, t1)
    await replaceWithBackup(backup, t2)
    expect(await db.products.count()).toBe(0)
  })

  it('bei einem Fehler bleibt alles unverändert', async () => {
    await createProduct(skyr, t0)
    await setSetting('theme', 'dark', t0)
    const backup = await roundTrip(t1)
    // settings ist die letzte Tabelle: Alle anderen sind schon geleert und neu befüllt, wenn das scheitert
    const theme = backup.tables.settings[0]!
    const broken = { ...backup, tables: { ...backup.tables, products: [], settings: [theme, theme] } }
    await expect(replaceWithBackup(broken, t2)).rejects.toThrow()
    expect(await db.products.count()).toBe(1)
    expect(await getSetting('theme')).toBe('dark')
  })
})

describe('mergeBackup', () => {
  it('übernimmt Neues, behält Lokales und zählt', async () => {
    await createProduct(skyr, t0)
    const backup = await roundTrip(t1)
    await Promise.all(db.tables.map((t) => t.clear()))
    await createProduct({ ...skyr, name: 'Nur lokal' }, t1)

    expect(await mergeBackup(backup, t2)).toEqual({ added: 1, updated: 0 })
    expect((await db.products.toArray()).map((p) => p.name).sort()).toEqual(['Nur lokal', 'Skyr natur'])
  })

  it('zweimal dasselbe Backup ändert beim zweiten Mal nichts', async () => {
    await createProduct(skyr, t0)
    const backup = await roundTrip(t1)
    await Promise.all(db.tables.map((t) => t.clear()))
    await mergeBackup(backup, t2)
    expect(await mergeBackup(backup, t2)).toEqual({ added: 0, updated: 0 })
  })

  it('gleicher Einstellungs-Schlüssel mit anderer id verletzt den eindeutigen Index nicht', async () => {
    await setSetting('theme', 'dark', t1)
    const backup = await roundTrip(t1)
    await Promise.all(db.tables.map((t) => t.clear()))
    await setSetting('theme', 'light', t0)

    expect(await mergeBackup(backup, t2)).toEqual({ added: 0, updated: 1 })
    expect(await getSetting('theme')).toBe('dark')
    expect(await db.settings.where('key').equals('theme').count()).toBe(1)
  })

  it('lastBackupAt: der spätere aus lokalem Stand und Exportzeit', async () => {
    const backup = await roundTrip(t1)
    await markBackedUp(t2)
    await mergeBackup(backup, t2)
    expect(await getLastBackupAt()).toBe(t2.toISOString())

    await Promise.all(db.tables.map((t) => t.clear()))
    await markBackedUp(t0)
    await mergeBackup(backup, t2)
    expect(await getLastBackupAt()).toBe(t1.toISOString())
  })
})
