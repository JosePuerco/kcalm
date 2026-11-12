// Einweg-Push auf Jans Server (Phase 14). Reine Funktionen ohne Datenbank und Netz, damit testbar.
//
// Grundidee „Quittungsliste“: Für jeden Datensatz merkt sich die App die Prüfsumme des Stands, den der Server
// bestätigt hat. Ausstehend ist alles, dessen aktuelle Prüfsumme abweicht oder fehlt. Quittierte Datensätze,
// die lokal nicht mehr existieren (echtes Löschen beim Backup-Import), werden als „entfernt“ gemeldet.
// So entsteht kein eigener Zustand, der verloren gehen kann: Die Daten selbst sind die Merkliste.

import { z } from 'zod'
import type { TableName } from '../db/schema.ts'
import type { SyncFields, Timestamp } from '../db/types.ts'
import { TABLE_NAMES, type BackupTables } from './backup.ts'

/** Version des Datenformats zwischen App und Server; bei Änderung beide Seiten anpassen */
export const PUSH_FORMAT_VERSION = 1

/** Datensätze je Anfrage; jedes Paket wird einzeln quittiert */
export const PUSH_BATCH_SIZE = 500

/** Nicht übertragen: gemerkte Scans (nur Zwischenzustand) und Einstellungen der App (Jan, 12.11.2026) */
export const PUSH_EXCLUDED_TABLES: readonly TableName[] = ['pendingScans', 'settings']

export const PUSH_TABLES: readonly TableName[] = TABLE_NAMES.filter((t) => !PUSH_EXCLUDED_TABLES.includes(t))

export type PushTables = Pick<BackupTables, (typeof PUSH_TABLES)[number]>

/** Berechnete Tagesziele (Phase 14b) laufen über dieselbe Quittungsliste; id = Datum */
export const TARGETS_TABLE = 'dailyTargets'

/** Tabellen der Datenbank plus die berechneten Tagesziele */
export type PushTable = TableName | typeof TARGETS_TABLE

/** Vom Server bestätigter Stand eines Datensatzes */
export interface PushReceipt {
  table: PushTable
  id: string
  hash: string
}

export type PushChange =
  | { op: 'upsert'; table: PushTable; id: string; hash: string; record: object }
  | { op: 'remove'; table: PushTable; id: string }

// --- Prüfsumme ---------------------------------------------------------------------------------

/**
 * JSON mit sortierten Schlüsseln: gleicher Inhalt ergibt immer denselben Text,
 * egal in welcher Reihenfolge die Felder gespeichert wurden. `undefined` fällt weg wie bei JSON.stringify.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const text = JSON.stringify(value)
    return text === undefined ? 'null' : text
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && typeof v !== 'function')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}

/** cyrb53: schnelle 53-Bit-Prüfsumme (kein Kryptoschutz nötig, es geht nur um „hat sich etwas geändert?“) */
function cyrb53(text: string, seed: number): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

/** Prüfsumme des vollständigen Datensatzes; zwei Durchläufe mit verschiedenem Startwert (≈ 106 Bit) */
export function recordHash(record: unknown): string {
  const text = stableStringify(record)
  return cyrb53(text, 1).toString(36) + '.' + cyrb53(text, 2).toString(36)
}

// --- Was ist ausstehend? -------------------------------------------------------------------------

const receiptKey = (table: string, id: string) => `${table}\u0000${id}`

/**
 * Änderungen gegenüber dem bestätigten Stand.
 * - neu oder anders als quittiert → upsert (auch ein gesetzter Löschmarker ist eine Änderung)
 * - quittiert, aber lokal nicht mehr da → remove
 * - Tabellen außerhalb von PUSH_TABLES werden ignoriert
 * Reihenfolge: Tabellen wie PUSH_TABLES, darin wie gespeichert; Entfernungen zuletzt.
 */
export function pendingChanges(tables: PushTables, receipts: readonly PushReceipt[]): PushChange[] {
  return diffRows(
    PUSH_TABLES.map((table) => ({ table, rows: tables[table as keyof PushTables] as SyncFields[] })),
    receipts,
    (r) => (r as SyncFields).id,
  )
}

/**
 * Abgleich beliebiger Zeilen mit der Quittungsliste, nur für die genannten Tabellen.
 * Quittungen anderer Tabellen bleiben unberührt (z. B. Tagesziele beim Abgleich der Datensätze).
 */
export function diffRows(
  groups: readonly { table: PushTable; rows: readonly object[] }[],
  receipts: readonly PushReceipt[],
  idOf: (row: object) => string,
): PushChange[] {
  const confirmed = new Map<string, string>()
  for (const r of receipts) confirmed.set(receiptKey(r.table, r.id), r.hash)
  const tables = new Set(groups.map((g) => g.table))

  const changes: PushChange[] = []
  const present = new Set<string>()
  for (const { table, rows } of groups) {
    for (const record of rows) {
      const id = idOf(record)
      const key = receiptKey(table, id)
      present.add(key)
      const hash = recordHash(record)
      if (confirmed.get(key) !== hash) changes.push({ op: 'upsert', table, id, hash, record })
    }
  }
  for (const r of receipts) {
    if (!tables.has(r.table)) continue
    const key = receiptKey(r.table, r.id)
    if (!present.has(key)) {
      present.add(key) // doppelte Quittungen nur einmal melden
      changes.push({ op: 'remove', table: r.table, id: r.id })
    }
  }
  return changes
}

/** Vollabgleich: alles als upsert, unabhängig von Quittungen; der Server markiert danach, was fehlte */
export function allRecords(tables: PushTables): PushChange[] {
  return pendingChanges(tables, [])
}

/** Neue Quittungsliste nach einem bestätigten Paket */
export function applyReceipts(receipts: readonly PushReceipt[], confirmed: readonly PushChange[]): PushReceipt[] {
  const map = new Map<string, PushReceipt>()
  for (const r of receipts) map.set(receiptKey(r.table, r.id), r)
  for (const c of confirmed) {
    const key = receiptKey(c.table, c.id)
    if (c.op === 'upsert') map.set(key, { table: c.table, id: c.id, hash: c.hash })
    else map.delete(key)
  }
  return [...map.values()]
}

export function chunk<T>(items: readonly T[], size = PUSH_BATCH_SIZE): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`Ungültige Paketgröße: ${size}`)
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

// --- Datenformat der Anfrage -------------------------------------------------------------------

export interface PushBody {
  formatVersion: typeof PUSH_FORMAT_VERSION
  upserts: { table: PushTable; id: string; record: object }[]
  removals: { table: PushTable; id: string }[]
  /** Nur beim Vollabgleich: gleiche id für alle Pakete; `last` beim letzten Paket */
  fullSync?: { id: string; last: boolean }
}

export function pushBody(changes: readonly PushChange[], fullSync?: PushBody['fullSync']): PushBody {
  const body: PushBody = {
    formatVersion: PUSH_FORMAT_VERSION,
    upserts: [],
    removals: [],
  }
  for (const c of changes) {
    if (c.op === 'upsert') body.upserts.push({ table: c.table, id: c.id, record: c.record })
    else body.removals.push({ table: c.table, id: c.id })
  }
  if (fullSync) body.fullSync = fullSync
  return body
}

// --- Einstellungen prüfen ----------------------------------------------------------------------

export type Checked = { ok: true; value: string } | { ok: false; error: string }

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** Server-Adresse: nur https (http nur für localhost beim Entwickeln), ohne Pfad-Schrägstrich am Ende */
export function normalizeServerUrl(input: string): Checked {
  const text = input.trim()
  if (text === '') return { ok: false, error: 'Bitte Server-Adresse eingeben' }
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return { ok: false, error: 'Keine gültige Adresse, z. B. https://kcalm-api.example.de' }
  }
  const local = LOCAL_HOSTS.has(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    return { ok: false, error: 'Adresse muss mit https:// beginnen' }
  }
  if (url.username || url.password) return { ok: false, error: 'Zugangsdaten gehören ins Token-Feld' }
  if (url.search || url.hash) return { ok: false, error: 'Adresse ohne ? oder # angeben' }
  const path = url.pathname.replace(/\/+$/, '')
  return { ok: true, value: `${url.origin}${path}` }
}

export function pushEndpoint(serverUrl: string): string {
  return `${serverUrl}/v1/push`
}

export const MIN_TOKEN_LENGTH = 16

export function checkToken(input: string): Checked {
  const token = input.trim()
  if (token === '') return { ok: false, error: 'Bitte Token eingeben' }
  if (/\s/.test(token)) return { ok: false, error: 'Token darf keine Leerzeichen enthalten' }
  if (token.length < MIN_TOKEN_LENGTH) return { ok: false, error: `Token zu kurz (mind. ${MIN_TOKEN_LENGTH} Zeichen)` }
  return { ok: true, value: token }
}

// --- Fehlertexte -------------------------------------------------------------------------------

export type PushFailure =
  | { kind: 'network' }
  | { kind: 'timeout' }
  | { kind: 'http'; status: number }
  | { kind: 'invalidResponse' }

/** Kurzer deutscher Text für „letzte Fehlermeldung“ in den Einstellungen */
export function pushErrorMessage(failure: PushFailure): string {
  switch (failure.kind) {
    case 'network':
      // Im Browser sehen fehlendes Netz, falsche Adresse und CORS-Ablehnung gleich aus
      return 'Server nicht erreichbar'
    case 'timeout':
      return 'Server antwortet nicht (Zeitüberschreitung)'
    case 'invalidResponse':
      return 'Unerwartete Antwort vom Server'
    case 'http': {
      const s = failure.status
      if (s === 401 || s === 403) return 'Token wird nicht akzeptiert'
      if (s === 404) return 'Adresse falsch: Push-Schnittstelle nicht gefunden'
      if (s === 409) return 'Server erwartet ein anderes Datenformat'
      if (s === 413) return 'Datenpaket zu groß'
      if (s === 429) return 'Zu viele Anfragen, später erneut'
      if (s >= 500) return `Serverfehler (${s})`
      return `Unerwartete Antwort (${s})`
    }
  }
}

// --- Einstellungen und Zustand (localStorage, nicht im Backup) ----------------------------------

export interface PushConfig {
  enabled: boolean
  /** wie eingegeben; geprüft wird mit normalizeServerUrl */
  serverUrl: string
  token: string
}

export interface PushState {
  /** Für welche Server-Adresse die Quittungsliste gilt; andere Adresse → Vollabgleich */
  receiptsFor: string | null
  /** Laufender (ggf. unterbrochener) Vollabgleich; gesetzt → beim nächsten Mal Vollabgleich */
  fullSyncId: string | null
  lastSuccessAt: Timestamp | null
  lastAttemptAt: Timestamp | null
  lastError: string | null
}

export const DEFAULT_PUSH_CONFIG: PushConfig = { enabled: false, serverUrl: '', token: '' }

export const DEFAULT_PUSH_STATE: PushState = {
  receiptsFor: null,
  fullSyncId: null,
  lastSuccessAt: null,
  lastAttemptAt: null,
  lastError: null,
}

const configSchema = z.object({ enabled: z.boolean(), serverUrl: z.string(), token: z.string() })
const nullableText = z.string().nullable()
const stateSchema = z.object({
  receiptsFor: nullableText,
  fullSyncId: nullableText,
  lastSuccessAt: nullableText,
  lastAttemptAt: nullableText,
  lastError: nullableText,
})

function parseStored<T>(text: string | null, schema: z.ZodType<T>, fallback: T): T {
  if (text === null) return fallback
  try {
    const result = schema.safeParse(JSON.parse(text))
    return result.success ? result.data : fallback
  } catch {
    return fallback
  }
}

/** Kaputtes oder fehlendes Gespeichertes → Push aus */
export function parsePushConfig(text: string | null): PushConfig {
  return parseStored(text, configSchema, DEFAULT_PUSH_CONFIG)
}

/** Kaputtes oder fehlendes Gespeichertes → Vollabgleich beim nächsten Mal (sichere Richtung) */
export function parsePushState(text: string | null): PushState {
  return parseStored(text, stateSchema, DEFAULT_PUSH_STATE)
}

export type ReadyConfig = { ok: true; serverUrl: string; token: string } | { ok: false; error: string }

/** Eingeschaltet und vollständig? Liefert die geprüfte Adresse und das Token */
export function readyConfig(config: PushConfig): ReadyConfig | null {
  if (!config.enabled) return null
  const url = normalizeServerUrl(config.serverUrl)
  if (!url.ok) return { ok: false, error: url.error }
  const token = checkToken(config.token)
  if (!token.ok) return { ok: false, error: token.error }
  return { ok: true, serverUrl: url.value, token: token.value }
}

/** Vollabgleich nötig: noch nie für diese Adresse abgeglichen, oder ein Vollabgleich wurde unterbrochen */
export function needsFullSync(state: PushState, serverUrl: string): boolean {
  return state.receiptsFor !== serverUrl || state.fullSyncId !== null
}

// --- Auslöser ------------------------------------------------------------------------------------

/** Verzögerung nach dem Speichern: mehrere schnelle Änderungen gehen in einem Push */
export const PUSH_DEBOUNCE_MS = 3000

/** Änderungen an diesen Tabellen lösen keinen Push aus (Quittungen selbst, gemerkte Scans) */
const QUIET_TABLES = ['pushState', 'pendingScans']

/**
 * Dexie meldet geänderte Bereiche als Schlüssel „idb://<Datenbank>/<Tabelle>/<Index>“.
 * true, wenn mindestens eine Tabelle betroffen ist, die zum Push gehört (oder ihn beeinflusst, z. B. settings
 * für die Verbrauchsschätzung). Ohne diesen Filter würde jede Quittung den nächsten Push anstoßen.
 */
export function isPushRelevantChange(parts: Iterable<string>, dbName = 'kcalm'): boolean {
  const prefix = `idb://${dbName}/`
  for (const part of parts) {
    if (!part.startsWith(prefix)) continue
    const table = part.slice(prefix.length).split('/')[0] ?? ''
    if (table !== '' && !QUIET_TABLES.includes(table)) return true
  }
  return false
}
