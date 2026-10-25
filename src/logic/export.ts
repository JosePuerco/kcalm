// Export (Export.dc.html): Zeitraum, Ebene, Spalten und die Dateien als CSV oder JSON.
// Reine Funktionen; die Oberfläche zeigt nur an. Regeln: PLAN.md Abschnitt 2 „Export“.
// Exportdateien sind international: Punkt als Dezimalzeichen, englische Schlüssel, UTF-8.
// Gerundet wird wie in der Anzeige; unbekannte Werte bleiben null, Summen mit Lücken stehen in `partial`.

import type { Entry, LocalDate, NutrientKey, ProfileAssignment, ProfileVersion, Slot, Weight } from '../db/types.ts'
import { addDays, daysBetween, isoWeek, weekStart } from './dates.ts'
import { slotsForDay } from './diary.ts'
import { firstPerDay } from './estimate.ts'
import { formatNumber } from './format.ts'
import { fixedDailyTarget } from './goals.ts'
import { sumNutrients, type NutrientSum } from './nutrients.ts'
import { goalFor } from './profiles.ts'

export type ExportLevel = 'entries' | 'slots' | 'days' | 'weeks'
export type ExportFormat = 'csv' | 'json'
export type ExportRangeKind = 'lastMonth' | 'weeks4' | 'all' | 'free'
export type ExportColumn =
  | 'date'
  | 'complete'
  | 'slot'
  | 'name'
  | 'amount'
  | 'budget'
  | 'weight'
  | NutrientKey

/** Version des Exportformats; steigt, wenn sich Schlüssel oder Bedeutung ändern */
export const EXPORT_VERSION = 1

const ALL: readonly ExportLevel[] = ['entries', 'slots', 'days', 'weeks']
const AGGREGATED: readonly ExportLevel[] = ['days', 'weeks']

type NutrientColumn = { key: NutrientKey; label: string; field: string; decimals: number }

/** Reihenfolge wie im Prototyp; Salz mit zwei Stellen, sonst eine */
const NUTRIENT_COLUMNS: readonly NutrientColumn[] = [
  { key: 'kcal', label: 'kcal', field: 'kcal', decimals: 0 },
  { key: 'protein', label: 'Eiweiß', field: 'protein_g', decimals: 1 },
  { key: 'carbs', label: 'Kohlenh.', field: 'carbs_g', decimals: 1 },
  { key: 'fat', label: 'Fett', field: 'fat_g', decimals: 1 },
  { key: 'satFat', label: 'Ges. Fett', field: 'satfat_g', decimals: 1 },
  { key: 'sugar', label: 'Zucker', field: 'sugar_g', decimals: 1 },
  { key: 'fiber', label: 'Ballastst.', field: 'fiber_g', decimals: 1 },
  { key: 'salt', label: 'Salz', field: 'salt_g', decimals: 2 },
]

export interface ExportColumnInfo {
  key: ExportColumn
  label: string
  levels: readonly ExportLevel[]
}

/** Alle Spalten-Chips; `levels` = Ebenen, auf denen die Spalte sinnvoll ist */
export const EXPORT_COLUMNS: readonly ExportColumnInfo[] = [
  { key: 'date', label: 'Datum', levels: ALL },
  { key: 'complete', label: 'Vollständig', levels: ALL },
  { key: 'slot', label: 'Slot', levels: ['entries', 'slots'] },
  { key: 'name', label: 'Name', levels: ['entries'] },
  { key: 'amount', label: 'Menge', levels: ['entries'] },
  ...NUTRIENT_COLUMNS.map((c) => ({ key: c.key, label: c.label, levels: ALL })),
  { key: 'budget', label: 'Budget', levels: AGGREGATED },
  { key: 'weight', label: 'Gewicht', levels: AGGREGATED },
]

/** Spalten, die auf der Ebene wählbar sind; Gewicht nur bei aktiver Verbrauchsschätzung */
export function columnsFor(level: ExportLevel, weightEnabled: boolean): ExportColumn[] {
  return EXPORT_COLUMNS.filter((c) => c.levels.includes(level) && (weightEnabled || c.key !== 'weight')).map(
    (c) => c.key,
  )
}

// ---------- Zeitraum ----------

export interface ExportRange {
  from: LocalDate
  to: LocalDate
}

/** Voriger Kalendermonat: am 25.10.2026 → 01.09.–30.09.2026 */
export function lastMonthRange(today: LocalDate): ExportRange {
  const to = addDays(`${today.slice(0, 7)}-01`, -1)
  return { from: `${to.slice(0, 7)}-01`, to }
}

/** 28 Tage bis einschließlich heute */
export function weeks4Range(today: LocalDate): ExportRange {
  return { from: addDays(today, -27), to: today }
}

export interface RangeOptions {
  /** Erster Tag mit Einträgen oder Gewicht (≤ heute); null = noch keine Daten */
  firstDate: LocalDate | null
  /** Frei gewählt; leer = noch nicht gewählt */
  from?: LocalDate | ''
  to?: LocalDate | ''
}

/**
 * Zeitraum zur Auswahl; null = nichts zu exportieren (keine Daten bzw. Start nach Ende).
 * Das Ende liegt nie nach heute, künftige Tage werden nicht exportiert.
 */
export function exportRange(kind: ExportRangeKind, today: LocalDate, options: RangeOptions): ExportRange | null {
  switch (kind) {
    case 'lastMonth':
      return lastMonthRange(today)
    case 'weeks4':
      return weeks4Range(today)
    case 'all':
      return options.firstDate !== null && options.firstDate <= today ? { from: options.firstDate, to: today } : null
    case 'free': {
      if (!options.from || !options.to) return null
      const to = options.to > today ? today : options.to
      return options.from <= to ? { from: options.from, to } : null
    }
  }
}

/** Anzahl Tage inklusive Start und Ende */
export function rangeDayCount(range: ExportRange): number {
  return daysBetween(range.from, range.to) + 1
}

function rangeDates(range: ExportRange): LocalDate[] {
  return Array.from({ length: rangeDayCount(range) }, (_, i) => addDays(range.from, i))
}

/** „2026-09-01“ → „01.09.2026“ */
function germanDate(date: LocalDate): string {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`
}

/** Zeile unter den Zeitraum-Chips: „01.09.2026 – 30.09.2026 · 30 Tage“ */
export function rangeText(range: ExportRange): string {
  const n = rangeDayCount(range)
  return `${germanDate(range.from)} – ${germanDate(range.to)} · ${formatNumber(n)} ${n === 1 ? 'Tag' : 'Tage'}`
}

/** Kalenderwoche nach ISO 8601: „2026-W36“; das Jahr ist das des Donnerstags */
export function isoWeekLabel(date: LocalDate): string {
  const thursday = addDays(weekStart(date), 3)
  return `${thursday.slice(0, 4)}-W${String(isoWeek(date)).padStart(2, '0')}`
}

// ---------- Zeilen ----------

/** Zellwert: Zahl, Text, Wahrheitswert, unbekannt (null) oder Liste (nur `partial`) */
export type ExportCell = string | number | boolean | null | readonly string[]

/** Tabelle mit festen Schlüsseln; jede Zeile hat einen Wert je Schlüssel */
export interface ExportTable {
  level: ExportLevel
  keys: string[]
  rows: ExportCell[][]
}

export interface ExportInput {
  range: ExportRange
  /** nicht gelöschte Einträge; Tage außerhalb des Zeitraums werden ignoriert */
  entries: readonly Entry[]
  /** als vollständig markierte Tage; zählt nur mit Einträgen (wie in der Statistik) */
  completeDates: ReadonlySet<LocalDate>
  slots: readonly Slot[]
  assignments: readonly Pick<
    ProfileAssignment,
    'validFrom' | 'profileVersionId' | 'weekBudgetOverride' | 'createdAt' | 'deletedAt'
  >[]
  versions: readonly Pick<ProfileVersion, 'id' | 'weeklyKcal'>[]
  /** nicht gelöschte Wiegungen; mehrere an einem Tag → die erste zählt */
  weights: readonly Pick<Weight, 'date' | 'kg' | 'measuredAt'>[]
}

/** Wie in der Anzeige gerundet, aber mit Punkt: 223,2 kcal → 223, 0,125 g Salz → 0.13 */
export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals
  const r = Math.round(value * f) / f
  // −0 vermeiden
  return r === 0 ? 0 : r
}

function roundOrNull(value: number | null, decimals: number): number | null {
  return value === null ? null : roundTo(value, decimals)
}

function chosenNutrients(columns: ReadonlySet<ExportColumn>): NutrientColumn[] {
  return NUTRIENT_COLUMNS.filter((c) => columns.has(c.key))
}

/** Schlüssel der Datei in fester Reihenfolge, abhängig von Ebene und Spalten */
export function exportKeys(level: ExportLevel, columns: ReadonlySet<ExportColumn>, weightEnabled = true): string[] {
  const on = new Set(columnsFor(level, weightEnabled).filter((c) => columns.has(c)))
  const keys: string[] = []
  if (on.has('date')) keys.push(...(level === 'weeks' ? ['week', 'from', 'to', 'days'] : ['date']))
  if (on.has('complete')) keys.push(level === 'weeks' ? 'complete_days' : 'complete')
  if (on.has('slot')) keys.push('slot')
  if (on.has('name')) keys.push('name')
  if (on.has('amount')) keys.push('amount', 'unit')
  const nutrients = chosenNutrients(on)
  keys.push(...nutrients.map((c) => c.field))
  if (on.has('budget')) keys.push('budget_kcal')
  if (on.has('weight')) keys.push('weight_kg')
  // Bei Einträgen zeigen die leeren Felder schon, was fehlt
  if (level !== 'entries' && nutrients.length > 0) keys.push('partial')
  return keys
}

type Sums = Record<NutrientKey, NutrientSum>

/** Werte einer Summe; null, wenn es gar keine Einträge gibt (= nicht getrackt) */
function sumCells(sums: Sums | null, nutrients: readonly NutrientColumn[]): Record<string, ExportCell> {
  const cells: Record<string, ExportCell> = {}
  const partial: string[] = []
  for (const c of nutrients) {
    const sum = sums?.[c.key]
    cells[c.field] = sum ? roundOrNull(sum.value, c.decimals) : null
    if (sum?.atLeast) partial.push(c.field)
  }
  if (nutrients.length > 0) cells.partial = partial
  return cells
}

function byDate(entries: readonly Entry[], range: ExportRange): Map<LocalDate, Entry[]> {
  const map = new Map<LocalDate, Entry[]>()
  for (const e of entries) {
    if (e.deletedAt !== null || e.date < range.from || e.date > range.to) continue
    const list = map.get(e.date)
    if (list) list.push(e)
    else map.set(e.date, [e])
  }
  return map
}

/** Festes Tagesziel des damals gültigen Profils (wie in der Statistik); null = vor dem ersten Profil */
function dayBudget(input: ExportInput, date: LocalDate): number | null {
  const goal = goalFor(input.assignments, input.versions, date)
  return goal ? fixedDailyTarget(goal.version.weeklyKcal) : null
}

/**
 * Wochenbudget, anteilig für die Tage im Zeitraum: Budget am letzten Tag mit Profil × Tage mit Profil ÷ 7.
 * Eine ganze Woche mit Wechsel „ab heute“ ergibt so genau das umgerechnete Wochenbudget.
 */
function weekBudget(input: ExportInput, dates: readonly LocalDate[]): number | null {
  let last: number | null = null
  let count = 0
  for (const date of dates) {
    const goal = goalFor(input.assignments, input.versions, date)
    if (!goal) continue
    last = goal.weekBudget
    count++
  }
  return last === null ? null : (last * count) / 7
}

/**
 * Zeilen des Exports. Einträge und Slots: nur vorhandene, nach Tag und Slot-Reihenfolge.
 * Tage: jeder Tag des Zeitraums, ohne Einträge mit null-Nährwerten. Wochen: Mo–So, angeschnitten auf den
 * Zeitraum; Nährwerte summiert, Gewicht = Ø der Wiegungen.
 */
export function exportTable(
  level: ExportLevel,
  columns: ReadonlySet<ExportColumn>,
  input: ExportInput,
  weightEnabled = true,
): ExportTable {
  const keys = exportKeys(level, columns, weightEnabled)
  const nutrients = chosenNutrients(new Set(columnsFor(level, weightEnabled).filter((c) => columns.has(c))))
  const entries = byDate(input.entries, input.range)
  const weights = new Map(firstPerDay(input.weights).map((w) => [w.date, w.kg]))
  const isComplete = (date: LocalDate) => input.completeDates.has(date) && entries.has(date)
  const records: Record<string, ExportCell>[] = []

  for (const date of level === 'weeks' ? [] : rangeDates(input.range)) {
    const list = entries.get(date) ?? []
    if (level === 'days') {
      records.push({
        date,
        complete: isComplete(date),
        ...sumCells(list.length > 0 ? sumNutrients(list.map((e) => e.nutrients)) : null, nutrients),
        budget_kcal: roundOrNull(dayBudget(input, date), 0),
        weight_kg: roundOrNull(weights.get(date) ?? null, 1),
      })
      continue
    }
    if (list.length === 0) continue
    for (const { slot, entries: slotEntries } of slotsForDay(input.slots, list)) {
      if (slotEntries.length === 0) continue
      if (level === 'slots') {
        records.push({
          date,
          complete: isComplete(date),
          slot: slot.name,
          ...sumCells(sumNutrients(slotEntries.map((e) => e.nutrients)), nutrients),
        })
        continue
      }
      for (const e of slotEntries) {
        const cells: Record<string, ExportCell> = {
          date,
          complete: isComplete(date),
          slot: slot.name,
          name: e.nameSnapshot,
          amount: roundOrNull(e.amount, 1),
          unit: e.unit,
        }
        for (const c of nutrients) cells[c.field] = roundOrNull(e.nutrients[c.key], c.decimals)
        records.push(cells)
      }
    }
  }

  if (level === 'weeks') {
    const weeks = new Map<LocalDate, LocalDate[]>()
    for (const date of rangeDates(input.range)) {
      const monday = weekStart(date)
      weeks.set(monday, [...(weeks.get(monday) ?? []), date])
    }
    for (const dates of weeks.values()) {
      const list = dates.flatMap((d) => entries.get(d) ?? [])
      const kgs = dates.map((d) => weights.get(d)).filter((kg) => kg !== undefined)
      const first = dates[0] as LocalDate
      records.push({
        week: isoWeekLabel(first),
        from: first,
        to: dates[dates.length - 1] as LocalDate,
        days: dates.length,
        complete_days: dates.filter(isComplete).length,
        ...sumCells(list.length > 0 ? sumNutrients(list.map((e) => e.nutrients)) : null, nutrients),
        budget_kcal: roundOrNull(weekBudget(input, dates), 0),
        weight_kg: kgs.length > 0 ? roundTo(kgs.reduce((a, b) => a + b, 0) / kgs.length, 1) : null,
      })
    }
  }

  return { level, keys, rows: records.map((r) => keys.map((k) => r[k] ?? null)) }
}

// ---------- Dateien ----------

/** CSV-Feld: Anführungszeichen, wenn Komma, Anführungszeichen oder Zeilenumbruch drin sind (RFC 4180) */
function csvField(cell: ExportCell): string {
  if (cell === null) return ''
  const text = Array.isArray(cell) ? cell.join(';') : String(cell)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** CSV mit Kopfzeile; `limit` = nur so viele Zeilen, danach „…“ (Vorschau) */
export function toCsv(table: ExportTable, limit = Infinity): string {
  const lines = [table.keys.join(','), ...table.rows.slice(0, limit).map((r) => r.map(csvField).join(','))]
  if (table.rows.length > limit) lines.push('…')
  return `${lines.join('\n')}\n`
}

const LEVEL_FILE: Readonly<Record<ExportLevel, string>> = {
  entries: 'eintraege',
  slots: 'slots',
  days: 'tage',
  weeks: 'wochen',
}

export interface JsonMeta {
  range: ExportRange
  exportedAt: string
}

/** JSON mit Kopf; `partial` nur, wenn etwas fehlt. `limit` wie bei toCsv. */
export function toJson(table: ExportTable, meta: JsonMeta, limit = Infinity): string {
  const rows = table.rows.slice(0, limit).map((row) => {
    const obj: Record<string, ExportCell> = {}
    table.keys.forEach((key, i) => {
      const cell = row[i] ?? null
      if (key === 'partial' && Array.isArray(cell) && cell.length === 0) return
      obj[key] = cell
    })
    return obj
  })
  const text = JSON.stringify(
    {
      app: 'kcalm',
      exportVersion: EXPORT_VERSION,
      exportedAt: meta.exportedAt,
      from: meta.range.from,
      to: meta.range.to,
      level: table.level,
      rows,
    },
    null,
    2,
  )
  // Vorschau: angedeutet, dass weitere Zeilen folgen
  const more = table.rows.length > limit ? text.replace(/\n {2}\]\n\}$/, ',\n    …\n  ]\n}') : text
  return `${more}\n`
}

export interface ExportFile {
  name: string
  type: string
  text: string
}

/** Dateiname, z. B. „kcalm-tage_2026-09-01_2026-09-30.json“ */
export function exportFileName(level: ExportLevel, range: ExportRange, format: ExportFormat): string {
  return `kcalm-${LEVEL_FILE[level]}_${range.from}_${range.to}.${format}`
}

export function exportFile(table: ExportTable, format: ExportFormat, meta: JsonMeta): ExportFile {
  return {
    name: exportFileName(table.level, meta.range, format),
    type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json',
    text: format === 'csv' ? toCsv(table) : toJson(table, meta),
  }
}

const COUNT_WORDS: Readonly<Record<ExportLevel, [string, string]>> = {
  entries: ['Eintrag', 'Einträge'],
  slots: ['Slot', 'Slots'],
  days: ['Tag', 'Tage'],
  weeks: ['Woche', 'Wochen'],
}

/** Knopf: „30 Tage als JSON teilen“ */
export function shareLabel(table: ExportTable, format: ExportFormat): string {
  const n = table.rows.length
  const [one, many] = COUNT_WORDS[table.level]
  return `${formatNumber(n)} ${n === 1 ? one : many} als ${format.toUpperCase()} teilen`
}

// ---------- Vorlage ----------

export interface ExportSettings {
  range: ExportRangeKind
  level: ExportLevel
  format: ExportFormat
  columns: ReadonlySet<ExportColumn>
}

/** Vorlage „Monatsauswertung Claude“ (PLAN.md Abschnitt 7) */
export const CLAUDE_TEMPLATE: ExportSettings = {
  range: 'lastMonth',
  level: 'days',
  format: 'json',
  columns: new Set<ExportColumn>(['date', 'complete', 'kcal', 'protein', 'carbs', 'fat', 'fiber', 'budget', 'weight']),
}

/**
 * Entsprechen die Einstellungen genau der Vorlage? Verglichen werden nur die auf der Ebene wählbaren
 * Spalten; ohne Verbrauchsschätzung fehlt Gewicht also auf beiden Seiten.
 */
export function isTemplate(settings: ExportSettings, weightEnabled: boolean): boolean {
  if (
    settings.range !== CLAUDE_TEMPLATE.range ||
    settings.level !== CLAUDE_TEMPLATE.level ||
    settings.format !== CLAUDE_TEMPLATE.format
  ) {
    return false
  }
  return columnsFor(settings.level, weightEnabled).every(
    (c) => settings.columns.has(c) === CLAUDE_TEMPLATE.columns.has(c),
  )
}
