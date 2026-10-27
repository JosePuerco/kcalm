// Backup nach PLAN.md Abschnitt 4: Format, Prüfung mit Zod, Migration, Zusammenführen, Erinnerung.
// Reine Funktionen ohne Datenbankzugriff. Grundsatz der Prüfung: Struktur und Typen streng,
// Inhalte großzügig – alles, was die App selbst speichern kann, muss wieder importierbar sein.

import { z } from 'zod'
import { SCHEMA_V1, type TableName } from '../db/schema.ts'
import type {
  BlsPref,
  Day,
  Entry,
  FoodRef,
  Meal,
  PendingScan,
  Product,
  ProductOverride,
  Profile,
  ProfileAssignment,
  ProfileVersion,
  Recipe,
  Setting,
  Slot,
  SyncFields,
  Timestamp,
  Weight,
} from '../db/types.ts'
import { formatTime } from './format.ts'

export const BACKUP_APP = 'kcalm'
export const BACKUP_FORMAT_VERSION = 5
/** Ab so vielen Tagen ohne Backup warnt die Einstellungsseite */
export const BACKUP_REMINDER_DAYS = 14

export interface BackupTables {
  products: Product[]
  productOverrides: ProductOverride[]
  blsPrefs: BlsPref[]
  meals: Meal[]
  recipes: Recipe[]
  slots: Slot[]
  entries: Entry[]
  days: Day[]
  profiles: Profile[]
  profileVersions: ProfileVersion[]
  profileAssignments: ProfileAssignment[]
  weights: Weight[]
  pendingScans: PendingScan[]
  settings: Setting[]
}

export interface Backup {
  app: typeof BACKUP_APP
  formatVersion: typeof BACKUP_FORMAT_VERSION
  exportedAt: Timestamp
  tables: BackupTables
}

export const TABLE_NAMES = Object.keys(SCHEMA_V1) as TableName[]

/** Tabellen mit eindeutigem Schlüssel (im Schema mit „&“), z. B. days → date */
export const UNIQUE_KEYS: Partial<Record<TableName, string>> = Object.fromEntries(
  TABLE_NAMES.flatMap((table) => {
    const unique = SCHEMA_V1[table].split(',').map((s) => s.trim()).find((s) => s.startsWith('&'))
    return unique ? [[table, unique.slice(1)]] : []
  }),
)

// ---------- Zod-Schema, 1:1 nach src/db/types.ts ----------

const timestamp = z.iso.datetime()
const localDate = z.iso.date()
/** null = unbekannt */
const nutrientValue = z.number().nullable()

const nutrients = z.object({
  kcal: nutrientValue,
  fat: nutrientValue,
  satFat: nutrientValue,
  carbs: nutrientValue,
  sugar: nutrientValue,
  fiber: nutrientValue,
  protein: nutrientValue,
  salt: nutrientValue,
})

const sync = {
  id: z.uuid(),
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp.nullable(),
}

const foodRef = z
  .string()
  .regex(/^(product|bls|recipe):.+$/)
  .transform((s) => s as FoodRef)
const unit = z.enum(['g', 'ml'])
const portion = z.object({ label: z.string(), amount: z.number() })
const macroTarget = z.object({ mode: z.enum(['g', 'percent', 'gPerKg', 'rest']), value: z.number().nullable() })

const product = z.object({
  ...sync,
  source: z.enum(['off', 'own']),
  barcode: z.string().nullable(),
  name: z.string(),
  brand: z.string().nullable(),
  unit,
  per100: nutrients,
  portions: z.array(portion),
  useOverride: z.boolean(),
  archived: z.boolean(),
  offFetchedAt: timestamp.nullable(),
})

const productOverride = z.object({
  ...sync,
  productRef: foodRef,
  per100: nutrients.partial(),
  verifiedAt: timestamp.nullable(),
  note: z.string().nullable(),
  unit: unit.nullable(),
})

const blsPref = z.object({
  ...sync,
  blsCode: z.string().min(1),
  portions: z.array(portion),
  useOverride: z.boolean(),
})

const meal = z.object({
  ...sync,
  name: z.string(),
  items: z.array(z.object({ ref: foodRef, amount: z.number(), unit, portionLabel: z.string().nullable() })),
  archived: z.boolean(),
})

const recipe = z.object({
  ...sync,
  name: z.string(),
  ingredients: z.array(z.object({ ref: foodRef, amount: z.number() })),
  finalWeightG: z.number(),
  portions: z.array(portion),
  archived: z.boolean(),
})

const slot = z.object({
  ...sync,
  name: z.string(),
  order: z.number(),
  timeFrom: z.string().nullable(),
  timeTo: z.string().nullable(),
  archived: z.boolean(),
})

const entry = z.object({
  ...sync,
  date: localDate,
  slotId: z.uuid(),
  kind: z.enum(['food', 'quick']),
  ref: foodRef.nullable(),
  nameSnapshot: z.string(),
  amount: z.number().nullable(),
  unit: unit.nullable(),
  portionLabel: z.string().nullable(),
  nutrients,
  mealGroupId: z.uuid().nullable(),
  mealName: z.string().nullable(),
})

const day = z.object({ ...sync, date: localDate, complete: z.boolean() })

const profile = z.object({ ...sync, name: z.string(), archived: z.boolean() })

const profileVersion = z.object({
  ...sync,
  profileId: z.uuid(),
  weeklyKcal: z.number(),
  protein: macroTarget,
  fat: macroTarget,
  carbs: macroTarget,
  fiberG: z.number().nullable(),
  manualWeightKg: z.number().nullable(),
})

const profileAssignment = z.object({
  ...sync,
  validFrom: localDate,
  profileVersionId: z.uuid(),
  weekBudgetOverride: z.number().nullable(),
})

const weight = z.object({
  ...sync,
  date: localDate,
  kg: z.number(),
  source: z.enum(['health', 'manual']),
  measuredAt: timestamp,
})

const pendingScan = z.object({
  ...sync,
  barcode: z.string(),
  scannedAt: timestamp,
  slotId: z.uuid().nullable(),
  date: localDate.nullable(),
})

const setting = z.object({ ...sync, key: z.string().min(1), value: z.unknown() })

// Der Typ stellt sicher, dass Schema und types.ts zusammenpassen (sonst meldet TypeScript einen Fehler).
const tableSchemas: { [K in TableName]: z.ZodType<BackupTables[K][number]> } = {
  products: product,
  productOverrides: productOverride,
  blsPrefs: blsPref,
  meals: meal,
  recipes: recipe,
  slots: slot,
  entries: entry,
  days: day,
  profiles: profile,
  profileVersions: profileVersion,
  profileAssignments: profileAssignment,
  weights: weight,
  pendingScans: pendingScan,
  settings: setting,
}

export const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  formatVersion: z.literal(BACKUP_FORMAT_VERSION),
  exportedAt: timestamp,
  tables: z.object({
    products: z.array(tableSchemas.products),
    productOverrides: z.array(tableSchemas.productOverrides),
    blsPrefs: z.array(tableSchemas.blsPrefs),
    meals: z.array(tableSchemas.meals),
    recipes: z.array(tableSchemas.recipes),
    slots: z.array(tableSchemas.slots),
    entries: z.array(tableSchemas.entries),
    days: z.array(tableSchemas.days),
    profiles: z.array(tableSchemas.profiles),
    profileVersions: z.array(tableSchemas.profileVersions),
    profileAssignments: z.array(tableSchemas.profileAssignments),
    weights: z.array(tableSchemas.weights),
    pendingScans: z.array(tableSchemas.pendingScans),
    settings: z.array(tableSchemas.settings),
  }),
})

// ---------- Erstellen ----------

export function buildBackup(tables: BackupTables, now = new Date()): Backup {
  return { app: BACKUP_APP, formatVersion: BACKUP_FORMAT_VERSION, exportedAt: now.toISOString(), tables }
}

/** Eingerückt, damit die Datei auch von Hand lesbar ist */
export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2)
}

/** „kcalm-backup-2026-10-21.json“ (lokales Datum) */
export function backupFileName(now = new Date()): string {
  return `kcalm-backup-${localDateString(now)}.json`
}

// ---------- Einlesen ----------

/**
 * Migrationen: Eintrag n wandelt Format n in Format n + 1 um.
 * Bei einer Formatänderung hier ergänzen und BACKUP_FORMAT_VERSION erhöhen.
 */
export const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
  1: (data) => {
    // Format 2: Nährwert „alcohol“ entfällt (Jan, 21.10.2026)
    const tables = isObject(data.tables) ? data.tables : {}
    for (const [table, field] of Object.entries(NUTRIENT_FIELDS)) {
      const records = tables[table]
      if (Array.isArray(records)) records.forEach((record) => removeAlcohol(record, field))
    }
    return { ...data, formatVersion: 2 }
  },
  2: (data) => {
    // Format 3: Umschalter Meine/Original auch für BLS (Jan, 21.10.2026)
    const tables = isObject(data.tables) ? data.tables : {}
    if (Array.isArray(tables.blsPrefs)) tables.blsPrefs.forEach(addBlsUseOverride)
    return { ...data, formatVersion: 3 }
  },
  3: (data) => {
    // Format 4: Wasser-Tracking entfällt (Jan, 22.10.2026)
    const tables = isObject(data.tables) ? data.tables : {}
    for (const [table, records] of Object.entries(tables)) {
      if (Array.isArray(records)) records.forEach((record) => removeWater(table, record))
    }
    if (Array.isArray(tables.settings)) {
      tables.settings = tables.settings.filter((s) => !(isObject(s) && s.key === WATER_SETTING_KEY))
    }
    return { ...data, formatVersion: 4 }
  },
  4: (data) => {
    // Format 5: Einheit g/ml in der Korrekturschicht (Jan, 27.10.2026)
    const tables = isObject(data.tables) ? data.tables : {}
    if (Array.isArray(tables.productOverrides)) tables.productOverrides.forEach(addOverrideUnit)
    return { ...data, formatVersion: 5 }
  },
}

/** Ergänzt productOverrides.unit = null (Original gilt), falls es fehlt (verändert record). Auch für das Datenbank-Update. */
export function addOverrideUnit(record: unknown): void {
  if (isObject(record) && !('unit' in record)) record.unit = null
}

/** Ergänzt blsPrefs.useOverride = true, falls es fehlt (verändert record). Auch für das Datenbank-Update. */
export function addBlsUseOverride(record: unknown): void {
  if (isObject(record) && !('useOverride' in record)) record.useOverride = true
}

/** Tabellen mit Nährwert-Objekt und dessen Feldname */
export const NUTRIENT_FIELDS = { products: 'per100', productOverrides: 'per100', entries: 'nutrients' } as const

/** Entfernt den früheren Nährwert „alcohol“ aus record[field] (verändert record). Auch für das Datenbank-Update. */
export function removeAlcohol(record: unknown, field: string): void {
  if (!isObject(record)) return
  const nutrients = record[field]
  if (isObject(nutrients)) delete nutrients.alcohol
}

/** Frühere Einstellung „Wasser tracken“ */
export const WATER_SETTING_KEY = 'waterEnabled'

/** Felder des früheren Wasser-Trackings je Tabelle */
const WATER_FIELDS: Record<string, readonly string[]> = {
  products: ['isDrink', 'countsAsWater'],
  blsPrefs: ['isDrink', 'countsAsWater'],
  entries: ['waterMl'],
  profileVersions: ['waterMl'],
}

/** Entfernt Wasser-Felder und den Nährwert „water“ (verändert record). Auch für das Datenbank-Update. */
export function removeWater(table: string, record: unknown): void {
  if (!isObject(record)) return
  for (const field of WATER_FIELDS[table] ?? []) delete record[field]
  const nutrientField = (NUTRIENT_FIELDS as Record<string, string>)[table]
  const nutrients = nutrientField === undefined ? undefined : record[nutrientField]
  if (isObject(nutrients)) delete nutrients.water
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string }

export const ERROR_NOT_BACKUP = 'Datei ist kein Kcalm-Backup'
export const ERROR_NEWER_VERSION = 'Backup stammt aus einer neueren App-Version'

export function parseBackup(text: string, migrations = MIGRATIONS): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: ERROR_NOT_BACKUP }
  }
  if (!isObject(data) || data.app !== BACKUP_APP) return { ok: false, error: ERROR_NOT_BACKUP }

  let version = data.formatVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: ERROR_NOT_BACKUP }
  }
  if (version > BACKUP_FORMAT_VERSION) return { ok: false, error: ERROR_NEWER_VERSION }

  let current = data
  while (version < BACKUP_FORMAT_VERSION) {
    const migrate = migrations[version]
    if (!migrate) return { ok: false, error: `Keine Migration für Format ${version}` }
    current = migrate(current)
    version += 1
  }

  const result = backupSchema.safeParse(current)
  if (!result.success) return { ok: false, error: damaged(issuePath(result.error.issues[0]?.path ?? [])) }

  const duplicate = findDuplicate(result.data.tables)
  if (duplicate) return { ok: false, error: damaged(duplicate) }

  return { ok: true, backup: result.data }
}

function damaged(where: string): string {
  return where ? `Backup ist beschädigt (${where})` : 'Backup ist beschädigt'
}

/** ['tables', 'entries', 12, 'date'] → „entries[12].date“ */
function issuePath(path: readonly PropertyKey[]): string {
  const rest = path[0] === 'tables' ? path.slice(1) : path
  return rest.reduce<string>((out, part) => {
    if (typeof part === 'number') return `${out}[${part}]`
    return out ? `${out}.${String(part)}` : String(part)
  }, '')
}

/** Doppelte id oder doppelter eindeutiger Schlüssel → Beschreibung, sonst null */
function findDuplicate(tables: BackupTables): string | null {
  for (const table of TABLE_NAMES) {
    const records = tables[table] as SyncFields[]
    const fields = ['id', UNIQUE_KEYS[table]].filter((f): f is string => f !== undefined)
    for (const field of fields) {
      const seen = new Set<unknown>()
      for (const record of records) {
        const value = (record as unknown as Record<string, unknown>)[field]
        if (seen.has(value)) return `${table}: ${field} „${String(value)}“ doppelt`
        seen.add(value)
      }
    }
  }
  return null
}

// ---------- Zusammenführen ----------

export interface MergePlan {
  /** Datensätze, die geschrieben werden (neu oder ersetzen den lokalen) */
  put: { [K in TableName]: BackupTables[K] }
  /** Lokale ids, die verschwinden, weil ein neuerer Datensatz mit gleichem Schlüssel sie ersetzt */
  remove: Record<TableName, string[]>
  added: number
  updated: number
}

/**
 * Pro id gewinnt der neuere updatedAt; bei Gleichstand bleibt der lokale.
 * Tabellen mit eindeutigem Schlüssel (days.date, settings.key …) vergleichen zusätzlich über den Schlüssel,
 * weil zwei Geräte denselben Schlüssel mit verschiedenen ids anlegen können.
 * Löschmarker werden wie normale Änderungen behandelt: Der neuere Stand gewinnt.
 */
export function mergeTables(local: BackupTables, incoming: BackupTables): MergePlan {
  const put = {} as Record<TableName, SyncFields[]>
  const remove = {} as Record<TableName, string[]>
  let added = 0
  let updated = 0

  for (const table of TABLE_NAMES) {
    const keyField = UNIQUE_KEYS[table]
    const keyOf = (r: SyncFields) => (keyField ? (r as unknown as Record<string, unknown>)[keyField] : undefined)

    const byId = new Map<string, SyncFields>()
    const byKey = new Map<unknown, SyncFields>()
    for (const r of local[table] as SyncFields[]) {
      byId.set(r.id, r)
      if (keyField) byKey.set(keyOf(r), r)
    }

    const tablePut = new Map<string, SyncFields>()
    const tableRemove = new Set<string>()

    for (const r of incoming[table] as SyncFields[]) {
      const candidates = new Set<SyncFields>()
      const sameId = byId.get(r.id)
      if (sameId) candidates.add(sameId)
      const sameKey = keyField ? byKey.get(keyOf(r)) : undefined
      if (sameKey) candidates.add(sameKey)

      if ([...candidates].some((c) => c.updatedAt >= r.updatedAt)) continue

      for (const c of candidates) {
        byId.delete(c.id)
        if (keyField) byKey.delete(keyOf(c))
        if (c.id !== r.id) {
          tableRemove.add(c.id)
          tablePut.delete(c.id)
        }
      }
      byId.set(r.id, r)
      if (keyField) byKey.set(keyOf(r), r)
      tablePut.set(r.id, r)
      tableRemove.delete(r.id)
      if (candidates.size === 0) added += 1
      else updated += 1
    }

    put[table] = [...tablePut.values()]
    remove[table] = [...tableRemove]
  }

  return { put: put as MergePlan['put'], remove, added, updated }
}

// ---------- Anzeige ----------

/** Aktive Einträge und Produkte fürs Import-Sheet */
export function backupSummary(backup: Backup): { entries: number; products: number } {
  const active = (records: SyncFields[]) => records.filter((r) => r.deletedAt === null).length
  return { entries: active(backup.tables.entries), products: active(backup.tables.products) }
}

export interface BackupStatus {
  text: string
  /** Warnfarbe: noch nie oder vor mindestens 14 Tagen gesichert */
  warn: boolean
}

/** Text der Backup-Zeile in den Einstellungen; Tage zählen nach Kalendertagen (Mitternacht) */
export function backupStatus(lastBackupAt: Timestamp | null, now = new Date()): BackupStatus {
  if (lastBackupAt === null) return { text: 'Noch kein Backup · bitte sichern', warn: true }
  const last = new Date(lastBackupAt)
  const days = Math.max(0, calendarDaysBetween(last, now))
  if (days === 0) return { text: `Gesichert heute, ${formatTime(last)}`, warn: false }
  if (days >= BACKUP_REMINDER_DAYS) return { text: `Letztes Backup vor ${days} Tagen · bitte sichern`, warn: true }
  if (days === 1) return { text: 'Letztes Backup gestern', warn: false }
  return { text: `Letztes Backup vor ${days} Tagen`, warn: false }
}

/** Nach einem Import: der spätere Zeitpunkt aus eigenem letzten Backup und Exportzeit der Datei */
export function lastBackupAfterImport(local: Timestamp | null, exportedAt: Timestamp): Timestamp {
  if (local === null) return exportedAt
  return new Date(local).getTime() >= new Date(exportedAt).getTime() ? local : exportedAt
}

// ---------- Hilfen ----------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Kalendertage zwischen zwei Zeitpunkten in lokaler Zeit (sommerzeitfest) */
function calendarDaysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b - a) / 86_400_000)
}
