import { describe, expect, it } from 'vitest'
import { newRecord, softDelete, touch, unknownNutrients } from '../db/records.ts'
import type { Day, Entry, Product, Setting } from '../db/types.ts'
import {
  backupFileName,
  backupStatus,
  backupSummary,
  buildBackup,
  ERROR_NEWER_VERSION,
  ERROR_NOT_BACKUP,
  lastBackupAfterImport,
  mergeTables,
  parseBackup,
  serializeBackup,
  TABLE_NAMES,
  UNIQUE_KEYS,
  type BackupTables,
} from './backup.ts'

const T0 = new Date('2026-10-01T10:00:00.000Z')
const T1 = new Date('2026-10-05T10:00:00.000Z')
const T2 = new Date('2026-10-09T10:00:00.000Z')

function emptyTables(): BackupTables {
  return Object.fromEntries(TABLE_NAMES.map((t) => [t, []])) as unknown as BackupTables
}

function product(name: string, now = T0): Product {
  return newRecord<Product>(
    {
      source: 'own',
      barcode: null,
      name,
      brand: null,
      unit: 'g',
      per100: { ...unknownNutrients(), kcal: 372, protein: 13.5 },
      portions: [{ label: '1 Portion', amount: 40 }],
      isDrink: false,
      countsAsWater: false,
      useOverride: false,
      archived: false,
      offFetchedAt: null,
    },
    now,
  )
}

function entry(productId: string, now = T0): Entry {
  return newRecord<Entry>(
    {
      date: '2026-10-01',
      slotId: crypto.randomUUID(),
      kind: 'food',
      ref: `product:${productId}`,
      nameSnapshot: 'Haferflocken',
      amount: 40,
      unit: 'g',
      portionLabel: '1 Portion',
      nutrients: { ...unknownNutrients(), kcal: 148.8 },
      waterMl: 0,
      mealGroupId: null,
      mealName: null,
    },
    now,
  )
}

function setting(key: string, value: unknown, now = T0): Setting {
  return newRecord<Setting>({ key, value }, now)
}

function day(date: string, complete: boolean, now = T0): Day {
  return newRecord<Day>({ date, complete }, now)
}

function sampleTables(): BackupTables {
  const tables = emptyTables()
  const p = product('Haferflocken')
  tables.products = [p, softDelete(product('Alt'), T1)]
  tables.entries = [entry(p.id)]
  tables.days = [day('2026-10-01', true)]
  tables.settings = [setting('theme', 'dark'), setting('quickSizes', [250, 500])]
  return tables
}

describe('UNIQUE_KEYS', () => {
  it('liest die eindeutigen Schlüssel aus dem Datenbankschema', () => {
    expect(UNIQUE_KEYS).toEqual({ productOverrides: 'productRef', blsPrefs: 'blsCode', days: 'date', settings: 'key' })
  })
})

describe('buildBackup / serializeBackup', () => {
  it('erzeugt app, formatVersion, exportedAt und alle Tabellen', () => {
    const backup = buildBackup(sampleTables(), T2)
    expect(backup.app).toBe('kcalm')
    expect(backup.formatVersion).toBe(1)
    expect(backup.exportedAt).toBe('2026-10-09T10:00:00.000Z')
    expect(Object.keys(backup.tables).sort()).toEqual([...TABLE_NAMES].sort())
  })

  it('übersteht den Weg Datei → Einlesen unverändert, inkl. gelöschter Datensätze und null', () => {
    const backup = buildBackup(sampleTables(), T2)
    const result = parseBackup(serializeBackup(backup))
    expect(result).toEqual({ ok: true, backup })
    if (result.ok) {
      expect(result.backup.tables.products[1]?.deletedAt).toBe(T1.toISOString())
      expect(result.backup.tables.products[0]?.per100.fat).toBeNull()
    }
  })

  it('ein leeres Backup ist gültig', () => {
    expect(parseBackup(serializeBackup(buildBackup(emptyTables(), T2))).ok).toBe(true)
  })
})

describe('backupFileName', () => {
  it('nutzt das lokale Datum', () => {
    expect(backupFileName(new Date(2026, 0, 5, 23, 59))).toBe('kcalm-backup-2026-01-05.json')
    expect(backupFileName(new Date(2026, 9, 21, 0, 0))).toBe('kcalm-backup-2026-10-21.json')
  })
})

describe('parseBackup – Ablehnung', () => {
  const valid = () => JSON.parse(serializeBackup(buildBackup(sampleTables(), T2))) as Record<string, unknown>
  const parse = (data: unknown) => parseBackup(JSON.stringify(data))

  it('kein JSON', () => {
    expect(parseBackup('das ist kein json')).toEqual({ ok: false, error: ERROR_NOT_BACKUP })
    expect(parseBackup('')).toEqual({ ok: false, error: ERROR_NOT_BACKUP })
  })

  it('JSON, aber keine Kcalm-Datei', () => {
    expect(parse([1, 2, 3])).toEqual({ ok: false, error: ERROR_NOT_BACKUP })
    expect(parse(null)).toEqual({ ok: false, error: ERROR_NOT_BACKUP })
    expect(parse({ ...valid(), app: 'mixli' })).toEqual({ ok: false, error: ERROR_NOT_BACKUP })
  })

  it('formatVersion fehlt oder ist unsinnig', () => {
    const without = valid()
    delete without.formatVersion
    expect(parse(without)).toEqual({ ok: false, error: ERROR_NOT_BACKUP })
    expect(parse({ ...valid(), formatVersion: '1' })).toEqual({ ok: false, error: ERROR_NOT_BACKUP })
    expect(parse({ ...valid(), formatVersion: 0 })).toEqual({ ok: false, error: ERROR_NOT_BACKUP })
    expect(parse({ ...valid(), formatVersion: 1.5 })).toEqual({ ok: false, error: ERROR_NOT_BACKUP })
  })

  it('neuere formatVersion als die App', () => {
    expect(parse({ ...valid(), formatVersion: 2 })).toEqual({ ok: false, error: ERROR_NEWER_VERSION })
  })

  it('fehlende Tabelle', () => {
    const data = valid()
    delete (data.tables as Record<string, unknown>).weights
    expect(parse(data)).toEqual({ ok: false, error: 'Backup ist beschädigt (weights)' })
  })

  it('falscher Wert nennt die Stelle', () => {
    const data = valid()
    const entries = (data.tables as { entries: Record<string, unknown>[] }).entries
    entries[0] = { ...entries[0], date: '01.10.2026' }
    expect(parse(data)).toEqual({ ok: false, error: 'Backup ist beschädigt (entries[0].date)' })
  })

  it('Nährwert 0 statt null ist erlaubt, ein Text nicht', () => {
    const data = valid()
    const products = (data.tables as { products: { per100: Record<string, unknown> }[] }).products
    products[0]!.per100.fat = 0
    expect(parse(data).ok).toBe(true)
    products[0]!.per100.fat = 'unbekannt'
    expect(parse(data)).toEqual({ ok: false, error: 'Backup ist beschädigt (products[0].per100.fat)' })
  })

  it('fehlender Nährwert (statt null) wird abgelehnt', () => {
    const data = valid()
    const products = (data.tables as { products: { per100: Record<string, unknown> }[] }).products
    delete products[0]!.per100.alcohol
    expect(parse(data)).toEqual({ ok: false, error: 'Backup ist beschädigt (products[0].per100.alcohol)' })
  })

  it('ungültige Verweise und ids', () => {
    const data = valid()
    const entries = (data.tables as { entries: Record<string, unknown>[] }).entries
    entries[0] = { ...entries[0], ref: 'irgendwas' }
    expect(parse(data)).toEqual({ ok: false, error: 'Backup ist beschädigt (entries[0].ref)' })
    entries[0] = { ...entries[0], ref: null, id: 'keine-uuid' }
    expect(parse(data)).toEqual({ ok: false, error: 'Backup ist beschädigt (entries[0].id)' })
  })

  it('doppelte id in einer Tabelle', () => {
    const data = valid()
    const products = (data.tables as { products: Record<string, unknown>[] }).products
    products[1] = { ...products[1], id: products[0]!.id }
    expect(parse(data)).toEqual({
      ok: false,
      error: `Backup ist beschädigt (products: id „${String(products[0]!.id)}“ doppelt)`,
    })
  })

  it('doppelter eindeutiger Schlüssel', () => {
    const data = valid()
    const tables = data.tables as { settings: Setting[] }
    tables.settings.push(setting('theme', 'light'))
    expect(parse(data)).toEqual({ ok: false, error: 'Backup ist beschädigt (settings: key „theme“ doppelt)' })
  })
})

describe('parseBackup – Toleranz', () => {
  it('unbekannte Zusatzfelder werden entfernt', () => {
    const data = JSON.parse(serializeBackup(buildBackup(sampleTables(), T2))) as Record<string, unknown>
    data.extra = 'egal'
    const products = (data.tables as { products: Record<string, unknown>[] }).products
    products[0]!.zukunft = true
    const result = parseBackup(JSON.stringify(data))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect('extra' in result.backup).toBe(false)
      expect('zukunft' in result.backup.tables.products[0]!).toBe(false)
    }
  })

  it('Einstellungen behalten beliebige Werte', () => {
    const result = parseBackup(serializeBackup(buildBackup(sampleTables(), T2)))
    expect(result.ok && result.backup.tables.settings[1]?.value).toEqual([250, 500])
  })
})

describe('mergeTables', () => {
  it('neue Datensätze werden hinzugefügt', () => {
    const incoming = emptyTables()
    incoming.products = [product('A'), product('B')]
    const plan = mergeTables(emptyTables(), incoming)
    expect(plan.put.products).toHaveLength(2)
    expect(plan.added).toBe(2)
    expect(plan.updated).toBe(0)
  })

  it('pro id gewinnt der neuere updatedAt', () => {
    const base = product('Original')
    const local = emptyTables()
    const incoming = emptyTables()
    local.products = [touch(base, { name: 'Lokal neuer' }, T2)]
    incoming.products = [touch(base, { name: 'Backup älter' }, T1)]
    expect(mergeTables(local, incoming).put.products).toEqual([])

    local.products = [touch(base, { name: 'Lokal älter' }, T1)]
    incoming.products = [touch(base, { name: 'Backup neuer' }, T2)]
    const plan = mergeTables(local, incoming)
    expect(plan.put.products.map((p) => p.name)).toEqual(['Backup neuer'])
    expect(plan.updated).toBe(1)
  })

  it('bei Gleichstand bleibt der lokale Datensatz', () => {
    const base = product('Gleich')
    const local = emptyTables()
    const incoming = emptyTables()
    local.products = [base]
    incoming.products = [{ ...base, name: 'Anders, gleiche Zeit' }]
    const plan = mergeTables(local, incoming)
    expect(plan.put.products).toEqual([])
    expect(plan.added + plan.updated).toBe(0)
  })

  it('ein neuerer Löschmarker im Backup löscht lokal', () => {
    const base = product('Wird gelöscht')
    const local = emptyTables()
    const incoming = emptyTables()
    local.products = [base]
    incoming.products = [softDelete(base, T1)]
    expect(mergeTables(local, incoming).put.products[0]?.deletedAt).toBe(T1.toISOString())
  })

  it('eine neuere lokale Änderung schlägt einen älteren Löschmarker', () => {
    const base = product('Bleibt')
    const local = emptyTables()
    const incoming = emptyTables()
    local.products = [touch(base, { name: 'Bleibt, geändert' }, T2)]
    incoming.products = [softDelete(base, T1)]
    expect(mergeTables(local, incoming).put.products).toEqual([])
  })

  it('gleicher Schlüssel, andere id: neuerer ersetzt älteren, alter wird entfernt', () => {
    const local = emptyTables()
    const incoming = emptyTables()
    const localTheme = setting('theme', 'light', T1)
    const backupTheme = setting('theme', 'dark', T2)
    local.settings = [localTheme]
    incoming.settings = [backupTheme]
    const plan = mergeTables(local, incoming)
    expect(plan.put.settings).toEqual([backupTheme])
    expect(plan.remove.settings).toEqual([localTheme.id])
    expect(plan.updated).toBe(1)
  })

  it('gleicher Schlüssel, andere id: älterer aus dem Backup wird ignoriert', () => {
    const local = emptyTables()
    const incoming = emptyTables()
    local.days = [day('2026-10-01', true, T2)]
    incoming.days = [day('2026-10-01', false, T1)]
    const plan = mergeTables(local, incoming)
    expect(plan.put.days).toEqual([])
    expect(plan.remove.days).toEqual([])
  })

  it('id passt zu einem, Schlüssel zu einem anderen lokalen Datensatz', () => {
    // Lokal: A (id 1, 10-01) und B (id 2, 10-02). Backup: id 1 jetzt mit Datum 10-02, neuer als beide.
    const a = day('2026-10-01', false, T0)
    const b = day('2026-10-02', false, T0)
    const local = emptyTables()
    const incoming = emptyTables()
    local.days = [a, b]
    incoming.days = [touch(a, { date: '2026-10-02', complete: true }, T2)]
    const plan = mergeTables(local, incoming)
    expect(plan.put.days.map((d) => [d.id, d.date])).toEqual([[a.id, '2026-10-02']])
    expect(plan.remove.days).toEqual([b.id])
  })

  it('Ergebnis verletzt keine eindeutigen Schlüssel', () => {
    const local = emptyTables()
    const incoming = emptyTables()
    local.settings = [setting('theme', 'light', T0), setting('water', true, T2)]
    incoming.settings = [setting('theme', 'dark', T1), setting('water', false, T1), setting('estimate', true, T1)]
    const plan = mergeTables(local, incoming)
    const removed = new Set(plan.remove.settings)
    const written = new Map(plan.put.settings.map((s) => [s.id, s]))
    const result = [...local.settings.filter((s) => !removed.has(s.id) && !written.has(s.id)), ...written.values()]
    expect(result.map((s) => `${s.key}=${String(s.value)}`).sort()).toEqual(['estimate=true', 'theme=dark', 'water=true'])
    expect(plan.added).toBe(1)
    expect(plan.updated).toBe(1)
  })

  it('Tabellen ohne eindeutigen Schlüssel vergleichen nur über die id', () => {
    const local = emptyTables()
    const incoming = emptyTables()
    local.products = [product('Haferflocken', T0)]
    incoming.products = [product('Haferflocken', T2)]
    const plan = mergeTables(local, incoming)
    expect(plan.put.products).toHaveLength(1)
    expect(plan.remove.products).toEqual([])
    expect(plan.added).toBe(1)
  })

  it('leeres Backup ändert nichts', () => {
    const plan = mergeTables(sampleTables(), emptyTables())
    expect(TABLE_NAMES.every((t) => plan.put[t].length === 0 && plan.remove[t].length === 0)).toBe(true)
  })
})

describe('backupSummary', () => {
  it('zählt nur aktive Einträge und Produkte', () => {
    expect(backupSummary(buildBackup(sampleTables(), T2))).toEqual({ entries: 1, products: 1 })
  })
})

describe('backupStatus', () => {
  const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min)
  const now = at(2026, 10, 21, 18, 30)

  it('noch nie gesichert', () => {
    expect(backupStatus(null, now)).toEqual({ text: 'Noch kein Backup · bitte sichern', warn: true })
  })

  it('heute mit Uhrzeit', () => {
    expect(backupStatus(at(2026, 10, 21, 8, 5).toISOString(), now)).toEqual({ text: 'Gesichert heute, 08:05', warn: false })
  })

  it('zählt Kalendertage, nicht 24-Stunden-Blöcke', () => {
    expect(backupStatus(at(2026, 10, 20, 23, 59).toISOString(), at(2026, 10, 21, 0, 1)).text).toBe(
      'Letztes Backup gestern',
    )
  })

  it('vor einigen Tagen, ohne Warnung', () => {
    expect(backupStatus(at(2026, 10, 18).toISOString(), now)).toEqual({ text: 'Letztes Backup vor 3 Tagen', warn: false })
    expect(backupStatus(at(2026, 10, 8).toISOString(), now)).toEqual({ text: 'Letztes Backup vor 13 Tagen', warn: false })
  })

  it('ab 14 Tagen Warnung', () => {
    expect(backupStatus(at(2026, 10, 7).toISOString(), now)).toEqual({
      text: 'Letztes Backup vor 14 Tagen · bitte sichern',
      warn: true,
    })
    expect(backupStatus(at(2026, 10, 5).toISOString(), now).text).toBe('Letztes Backup vor 16 Tagen · bitte sichern')
  })

  it('über die Zeitumstellung hinweg', () => {
    // 25.10.2026: Ende der Sommerzeit
    expect(backupStatus(at(2026, 10, 24, 12).toISOString(), at(2026, 10, 26, 12)).text).toBe('Letztes Backup vor 2 Tagen')
  })

  it('Zeitpunkt in der Zukunft (Uhr verstellt) zählt als heute', () => {
    expect(backupStatus(at(2026, 10, 25).toISOString(), now).warn).toBe(false)
  })
})

describe('lastBackupAfterImport', () => {
  it('nimmt den späteren Zeitpunkt', () => {
    expect(lastBackupAfterImport(null, T1.toISOString())).toBe(T1.toISOString())
    expect(lastBackupAfterImport(T2.toISOString(), T1.toISOString())).toBe(T2.toISOString())
    expect(lastBackupAfterImport(T0.toISOString(), T1.toISOString())).toBe(T1.toISOString())
  })
})
