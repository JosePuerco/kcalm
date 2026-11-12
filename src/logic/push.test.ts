import { describe, expect, it } from 'vitest'
import { newRecord, softDelete, touch } from '../db/records.ts'
import type { Day, Entry, Setting, Weight } from '../db/types.ts'
import {
  DEFAULT_PUSH_CONFIG,
  isPushRelevantChange,
  DEFAULT_PUSH_STATE,
  needsFullSync,
  parsePushConfig,
  parsePushState,
  readyConfig,
  allRecords,
  applyReceipts,
  checkToken,
  chunk,
  normalizeServerUrl,
  pendingChanges,
  PUSH_BATCH_SIZE,
  PUSH_EXCLUDED_TABLES,
  PUSH_FORMAT_VERSION,
  PUSH_TABLES,
  pushBody,
  pushEndpoint,
  pushErrorMessage,
  recordHash,
  stableStringify,
  type PushChange,
  type PushReceipt,
  type PushTables,
} from './push.ts'

const t0 = new Date('2026-11-12T08:00:00.000Z')
const t1 = new Date('2026-11-12T09:00:00.000Z')

function emptyTables(): PushTables {
  return Object.fromEntries(PUSH_TABLES.map((t) => [t, []])) as unknown as PushTables
}

function entry(kcal: number | null = 250): Entry {
  return newRecord<Entry>(
    {
      date: '2026-11-12',
      slotId: 'slot-1',
      kind: 'food',
      ref: 'bls:B123',
      nameSnapshot: 'Haferflocken',
      amount: 60,
      unit: 'g',
      portionLabel: null,
      nutrients: { kcal, fat: 4, satFat: 0.7, carbs: 35, sugar: 0.5, fiber: 6, protein: 8, salt: null },
      mealGroupId: null,
      mealName: null,
      cost: null,
    },
    t0,
  )
}

/** Simuliert einen erfolgreichen Push: alles Ausstehende wird quittiert */
function pushAll(tables: PushTables, receipts: PushReceipt[]): PushReceipt[] {
  return applyReceipts(receipts, pendingChanges(tables, receipts))
}

describe('stableStringify', () => {
  it('ist unabhängig von der Reihenfolge der Schlüssel', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }))
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}')
  })

  it('behält die Reihenfolge in Listen', () => {
    expect(stableStringify([2, 1])).not.toBe(stableStringify([1, 2]))
  })

  it('unterscheidet null, fehlend und 0', () => {
    expect(stableStringify({ a: null })).toBe('{"a":null}')
    expect(stableStringify({ a: undefined })).toBe('{}')
    expect(stableStringify({ a: 0 })).not.toBe(stableStringify({ a: null }))
  })

  it('kann Zeichenketten mit Sonderzeichen', () => {
    expect(JSON.parse(stableStringify({ 'ä"\n': 'Müsli "Nuss"' }))).toEqual({ 'ä"\n': 'Müsli "Nuss"' })
  })
})

describe('recordHash', () => {
  it('ist für gleichen Inhalt gleich, auch bei anderer Feldreihenfolge', () => {
    const e = entry()
    const reordered = Object.fromEntries(Object.entries(e).reverse())
    expect(recordHash(reordered)).toBe(recordHash(e))
  })

  it('ändert sich bei jeder Feldänderung, auch tief verschachtelt', () => {
    const e = entry()
    expect(recordHash({ ...e, amount: 61 })).not.toBe(recordHash(e))
    expect(recordHash({ ...e, nutrients: { ...e.nutrients, salt: 0 } })).not.toBe(recordHash(e))
    expect(recordHash(softDelete(e, t1))).not.toBe(recordHash(e))
  })

  it('hat bei vielen ähnlichen Datensätzen keine Kollision', () => {
    const hashes = new Set<string>()
    for (let i = 0; i < 20000; i++) hashes.add(recordHash({ id: 'x', amount: i }))
    expect(hashes.size).toBe(20000)
  })
})

describe('Tabellen', () => {
  it('überträgt alle Tabellen außer gemerkten Scans und Einstellungen', () => {
    expect(PUSH_EXCLUDED_TABLES).toEqual(['pendingScans', 'settings'])
    expect(PUSH_TABLES).toContain('entries')
    expect(PUSH_TABLES).toContain('days')
    expect(PUSH_TABLES).toContain('profileAssignments')
    expect(PUSH_TABLES).not.toContain('settings')
    expect(PUSH_TABLES).not.toContain('pendingScans')
    expect(PUSH_TABLES).toHaveLength(12)
  })
})

describe('pendingChanges', () => {
  it('leere Datenbank, keine Quittungen → nichts', () => {
    expect(pendingChanges(emptyTables(), [])).toEqual([])
  })

  it('neuer Datensatz → upsert mit vollständigem Datensatz', () => {
    const tables = emptyTables()
    const e = entry()
    tables.entries.push(e)
    const changes = pendingChanges(tables, [])
    expect(changes).toEqual([{ op: 'upsert', table: 'entries', id: e.id, hash: recordHash(e), record: e }])
  })

  it('nach Quittung ist nichts mehr ausstehend (doppelt senden entsteht nicht)', () => {
    const tables = emptyTables()
    tables.entries.push(entry())
    const receipts = pushAll(tables, [])
    expect(pendingChanges(tables, receipts)).toEqual([])
  })

  it('geänderter Datensatz → upsert mit neuem Stand', () => {
    const tables = emptyTables()
    const e = entry()
    tables.entries.push(e)
    const receipts = pushAll(tables, [])
    const changed = touch(e, { amount: 80 }, t1)
    tables.entries[0] = changed
    const changes = pendingChanges(tables, receipts)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ op: 'upsert', id: e.id, record: { amount: 80 } })
  })

  it('Änderung ohne neues updatedAt (z. B. Migration) wird trotzdem erkannt', () => {
    const tables = emptyTables()
    const e = entry()
    tables.entries.push(e)
    const receipts = pushAll(tables, [])
    tables.entries[0] = { ...e, cost: 1.2 }
    expect(pendingChanges(tables, receipts)).toHaveLength(1)
  })

  it('älterer Stand (Backup ersetzt) wird ebenfalls gesendet', () => {
    const tables = emptyTables()
    const old = entry()
    const newer = touch(old, { amount: 90 }, t1)
    tables.entries.push(newer)
    const receipts = pushAll(tables, [])
    tables.entries[0] = old
    expect(pendingChanges(tables, receipts)).toMatchObject([{ op: 'upsert', record: { amount: 60 } }])
  })

  it('Löschmarker → upsert mit deletedAt', () => {
    const tables = emptyTables()
    const e = entry()
    tables.entries.push(e)
    const receipts = pushAll(tables, [])
    tables.entries[0] = softDelete(e, t1)
    expect(pendingChanges(tables, receipts)).toMatchObject([
      { op: 'upsert', id: e.id, record: { deletedAt: t1.toISOString() } },
    ])
  })

  it('echt entfernt (Backup-Import) → remove', () => {
    const tables = emptyTables()
    const e = entry()
    tables.entries.push(e)
    const receipts = pushAll(tables, [])
    tables.entries.length = 0
    expect(pendingChanges(tables, receipts)).toEqual([{ op: 'remove', table: 'entries', id: e.id }])
  })

  it('gleiche id in verschiedenen Tabellen wird getrennt behandelt', () => {
    const tables = emptyTables()
    const day = newRecord<Day>({ date: '2026-11-12', complete: true }, t0)
    const weight = { ...newRecord<Weight>({ date: '2026-11-12', kg: 80, source: 'manual', measuredAt: t0.toISOString() }, t0), id: day.id }
    tables.days.push(day)
    tables.weights.push(weight)
    const receipts = pushAll(tables, [])
    expect(receipts).toHaveLength(2)
    tables.weights.length = 0
    expect(pendingChanges(tables, receipts)).toEqual([{ op: 'remove', table: 'weights', id: day.id }])
  })

  it('ignoriert Quittungen und Datensätze ausgeschlossener Tabellen', () => {
    const tables = emptyTables() as PushTables & { settings?: Setting[] }
    tables.settings = [newRecord<Setting>({ key: 'theme', value: 'dark' }, t0)]
    const receipts: PushReceipt[] = [{ table: 'settings', id: 'alt', hash: 'x' }]
    expect(pendingChanges(tables, receipts)).toEqual([])
  })

  it('meldet doppelte Quittungen nur einmal als entfernt', () => {
    const receipts: PushReceipt[] = [
      { table: 'entries', id: 'a', hash: 'x' },
      { table: 'entries', id: 'a', hash: 'y' },
    ]
    expect(pendingChanges(emptyTables(), receipts)).toEqual([{ op: 'remove', table: 'entries', id: 'a' }])
  })

  it('Reihenfolge: Tabellen nach PUSH_TABLES, Entfernungen zuletzt', () => {
    const tables = emptyTables()
    const e = entry()
    const d = newRecord<Day>({ date: '2026-11-12', complete: true }, t0)
    tables.entries.push(e)
    tables.days.push(d)
    const receipts: PushReceipt[] = [{ table: 'products', id: 'weg', hash: 'x' }]
    const ops = pendingChanges(tables, receipts).map((c) => `${c.op}:${c.table}`)
    expect(ops).toEqual(['upsert:entries', 'upsert:days', 'remove:products'])
  })
})

describe('allRecords (Vollabgleich)', () => {
  it('liefert alles als upsert, auch gelöschte Datensätze', () => {
    const tables = emptyTables()
    tables.entries.push(entry(), softDelete(entry(), t1))
    const changes = allRecords(tables)
    expect(changes).toHaveLength(2)
    expect(changes.every((c) => c.op === 'upsert')).toBe(true)
  })
})

describe('applyReceipts', () => {
  it('Teilerfolg: nur das bestätigte Paket wird quittiert, der Rest bleibt ausstehend', () => {
    const tables = emptyTables()
    for (let i = 0; i < 5; i++) tables.entries.push(entry(i))
    const changes = pendingChanges(tables, [])
    const first = chunk(changes, 2)[0] ?? []
    const receipts = applyReceipts([], first)
    expect(pendingChanges(tables, receipts)).toHaveLength(3)
  })

  it('remove löscht die Quittung, upsert ersetzt sie', () => {
    const start: PushReceipt[] = [
      { table: 'entries', id: 'a', hash: 'alt' },
      { table: 'entries', id: 'b', hash: 'alt' },
    ]
    const confirmed: PushChange[] = [
      { op: 'remove', table: 'entries', id: 'a' },
      { op: 'upsert', table: 'entries', id: 'b', hash: 'neu', record: {} as Entry },
    ]
    expect(applyReceipts(start, confirmed)).toEqual([{ table: 'entries', id: 'b', hash: 'neu' }])
  })

  it('ist idempotent: dasselbe Paket zweimal quittiert ändert nichts', () => {
    const tables = emptyTables()
    tables.entries.push(entry())
    const changes = pendingChanges(tables, [])
    const once = applyReceipts([], changes)
    expect(applyReceipts(once, changes)).toEqual(once)
  })
})

describe('chunk', () => {
  it('teilt in Pakete der gewünschten Größe', () => {
    expect(chunk([], 2)).toEqual([])
    expect(chunk([1], 2)).toEqual([[1]])
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('Standardgröße 500: 500 → ein Paket, 501 → zwei', () => {
    expect(PUSH_BATCH_SIZE).toBe(500)
    expect(chunk(Array.from({ length: 500 }, (_, i) => i))).toHaveLength(1)
    expect(chunk(Array.from({ length: 501 }, (_, i) => i)).map((c) => c.length)).toEqual([500, 1])
  })

  it('lehnt ungültige Größen ab', () => {
    expect(() => chunk([1], 0)).toThrow(RangeError)
    expect(() => chunk([1], 1.5)).toThrow(RangeError)
  })
})

describe('pushBody', () => {
  it('trennt upserts und removals und nennt die Formatversion', () => {
    const e = entry()
    const changes: PushChange[] = [
      { op: 'upsert', table: 'entries', id: e.id, hash: 'h', record: e },
      { op: 'remove', table: 'days', id: 'd1' },
    ]
    expect(pushBody(changes)).toEqual({
      formatVersion: PUSH_FORMAT_VERSION,
      upserts: [{ table: 'entries', id: e.id, record: e }],
      removals: [{ table: 'days', id: 'd1' }],
    })
  })

  it('enthält das lokale Datum unverändert (keine Zeitzonen-Umrechnung)', () => {
    const e = { ...entry(), date: '2026-11-12' }
    const json = JSON.parse(JSON.stringify(pushBody(allRecords({ ...emptyTables(), entries: [e] }))))
    expect(json.upserts[0].record.date).toBe('2026-11-12')
  })

  it('übernimmt unbekannte Nährwerte als null, nicht 0', () => {
    const json = JSON.parse(JSON.stringify(pushBody(allRecords({ ...emptyTables(), entries: [entry(null)] }))))
    expect(json.upserts[0].record.nutrients.kcal).toBeNull()
  })

  it('Vollabgleich nur, wenn angegeben', () => {
    expect(pushBody([])).not.toHaveProperty('fullSync')
    expect(pushBody([], { id: 's1', last: true }).fullSync).toEqual({ id: 's1', last: true })
  })
})

describe('normalizeServerUrl', () => {
  it('akzeptiert https und entfernt Schrägstriche am Ende', () => {
    expect(normalizeServerUrl(' https://kcalm-api.dunkleschokola.de/ ')).toEqual({
      ok: true,
      value: 'https://kcalm-api.dunkleschokola.de',
    })
    expect(normalizeServerUrl('https://example.de/api//')).toEqual({ ok: true, value: 'https://example.de/api' })
  })

  it('erlaubt http nur für localhost', () => {
    expect(normalizeServerUrl('http://localhost:3000')).toEqual({ ok: true, value: 'http://localhost:3000' })
    expect(normalizeServerUrl('http://127.0.0.1:3000').ok).toBe(true)
    expect(normalizeServerUrl('http://pi.local:3000')).toEqual({ ok: false, error: 'Adresse muss mit https:// beginnen' })
  })

  it('lehnt Leeres, Unsinn, Zugangsdaten, ? und # ab', () => {
    expect(normalizeServerUrl('   ').ok).toBe(false)
    expect(normalizeServerUrl('kcalm-api.dunkleschokola.de').ok).toBe(false)
    expect(normalizeServerUrl('ftp://example.de').ok).toBe(false)
    expect(normalizeServerUrl('https://jan:geheim@example.de').ok).toBe(false)
    expect(normalizeServerUrl('https://example.de/?token=x').ok).toBe(false)
    expect(normalizeServerUrl('https://example.de/#x').ok).toBe(false)
  })

  it('Endpunkt hängt /v1/push an', () => {
    expect(pushEndpoint('https://example.de')).toBe('https://example.de/v1/push')
    expect(pushEndpoint('https://example.de/api')).toBe('https://example.de/api/v1/push')
  })
})

describe('checkToken', () => {
  it('akzeptiert ein langes Token und schneidet Leerraum außen ab', () => {
    expect(checkToken('  abcdefghijklmnop+/=  ')).toEqual({ ok: true, value: 'abcdefghijklmnop+/=' })
  })

  it('lehnt leer, zu kurz und Leerzeichen innen ab', () => {
    expect(checkToken('')).toEqual({ ok: false, error: 'Bitte Token eingeben' })
    expect(checkToken('abc').ok).toBe(false)
    expect(checkToken('abcdefgh ijklmnopq').ok).toBe(false)
  })
})

describe('pushErrorMessage', () => {
  it('übersetzt Fehler in kurze deutsche Texte', () => {
    expect(pushErrorMessage({ kind: 'network' })).toBe('Server nicht erreichbar')
    expect(pushErrorMessage({ kind: 'timeout' })).toBe('Server antwortet nicht (Zeitüberschreitung)')
    expect(pushErrorMessage({ kind: 'invalidResponse' })).toBe('Unerwartete Antwort vom Server')
    expect(pushErrorMessage({ kind: 'http', status: 401 })).toBe('Token wird nicht akzeptiert')
    expect(pushErrorMessage({ kind: 'http', status: 403 })).toBe('Token wird nicht akzeptiert')
    expect(pushErrorMessage({ kind: 'http', status: 404 })).toBe('Adresse falsch: Push-Schnittstelle nicht gefunden')
    expect(pushErrorMessage({ kind: 'http', status: 409 })).toBe('Server erwartet ein anderes Datenformat')
    expect(pushErrorMessage({ kind: 'http', status: 413 })).toBe('Datenpaket zu groß')
    expect(pushErrorMessage({ kind: 'http', status: 429 })).toBe('Zu viele Anfragen, später erneut')
    expect(pushErrorMessage({ kind: 'http', status: 502 })).toBe('Serverfehler (502)')
    expect(pushErrorMessage({ kind: 'http', status: 418 })).toBe('Unerwartete Antwort (418)')
  })
})

describe('Einstellungen und Zustand', () => {
  it('fehlend oder kaputt → Push aus bzw. leerer Zustand', () => {
    expect(parsePushConfig(null)).toEqual(DEFAULT_PUSH_CONFIG)
    expect(parsePushConfig('{kaputt')).toEqual(DEFAULT_PUSH_CONFIG)
    expect(parsePushConfig('{"enabled":"ja"}')).toEqual(DEFAULT_PUSH_CONFIG)
    expect(parsePushState(null)).toEqual(DEFAULT_PUSH_STATE)
    expect(parsePushState('[]')).toEqual(DEFAULT_PUSH_STATE)
  })

  it('liest Gespeichertes zurück', () => {
    const config = { enabled: true, serverUrl: 'https://a.example', token: 'x'.repeat(20) }
    expect(parsePushConfig(JSON.stringify(config))).toEqual(config)
    const state = { ...DEFAULT_PUSH_STATE, receiptsFor: 'https://a.example', lastError: 'Server nicht erreichbar' }
    expect(parsePushState(JSON.stringify(state))).toEqual(state)
  })

  it('readyConfig: aus → null, unvollständig → Fehler, vollständig → geprüfte Werte', () => {
    expect(readyConfig(DEFAULT_PUSH_CONFIG)).toBeNull()
    expect(readyConfig({ enabled: true, serverUrl: '', token: '' })).toEqual({ ok: false, error: 'Bitte Server-Adresse eingeben' })
    expect(readyConfig({ enabled: true, serverUrl: 'https://a.example', token: '' })).toEqual({
      ok: false,
      error: 'Bitte Token eingeben',
    })
    expect(readyConfig({ enabled: true, serverUrl: 'https://a.example/ ', token: ' abcdefghijklmnopq ' })).toEqual({
      ok: true,
      serverUrl: 'https://a.example',
      token: 'abcdefghijklmnopq',
    })
  })

  it('Vollabgleich bei neuer oder anderer Adresse und nach Abbruch', () => {
    const synced = { ...DEFAULT_PUSH_STATE, receiptsFor: 'https://a.example' }
    expect(needsFullSync(DEFAULT_PUSH_STATE, 'https://a.example')).toBe(true)
    expect(needsFullSync(synced, 'https://a.example')).toBe(false)
    expect(needsFullSync(synced, 'https://b.example')).toBe(true)
    expect(needsFullSync({ ...synced, fullSyncId: 'voll-1' }, 'https://a.example')).toBe(true)
  })
})

describe('isPushRelevantChange', () => {
  it('Einträge, Profile, Einstellungen → ja', () => {
    expect(isPushRelevantChange(['idb://kcalm/entries/', 'idb://kcalm/entries/:dels'])).toBe(true)
    expect(isPushRelevantChange(['idb://kcalm/profileAssignments/validFrom'])).toBe(true)
    expect(isPushRelevantChange(['idb://kcalm/settings/key'])).toBe(true)
  })

  it('nur Quittungen oder gemerkte Scans → nein (keine Endlosschleife)', () => {
    expect(isPushRelevantChange(['idb://kcalm/pushState/', 'idb://kcalm/pushState/:dels'])).toBe(false)
    expect(isPushRelevantChange(['idb://kcalm/pendingScans/barcode'])).toBe(false)
    expect(isPushRelevantChange([])).toBe(false)
  })

  it('andere Datenbanken zählen nicht', () => {
    expect(isPushRelevantChange(['idb://andere/entries/'])).toBe(false)
  })

  it('gemischt → ja', () => {
    expect(isPushRelevantChange(['idb://kcalm/pushState/', 'idb://kcalm/days/date'])).toBe(true)
  })
})
