// Werte für die Tagesansicht (Kern.dc.html, Leer.dc.html). Reine Funktionen; die Oberfläche zeigt nur an.

import type { Entry, LocalDate, ProfileVersion, Slot } from '../db/types.ts'
import { addDays, weekdayIndex } from './dates.ts'
import { formatNumber } from './format.ts'
import { dynamicTargetFor, macroGoals, weekStatus, type KcalByDate, type WeekStatus } from './goals.ts'
import { sumNutrients, type NutrientSum } from './nutrients.ts'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const
const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const

export function weekdayShort(date: LocalDate): string {
  return WEEKDAYS[weekdayIndex(date)] ?? ''
}

/** Tagesleiste: „Do 22.10.“ und daneben „· Heute“ / „· Gestern“ / „· Morgen“ */
export function dayLabel(date: LocalDate, today: LocalDate): { date: string; relative: string | null } {
  const text = `${weekdayShort(date)} ${date.slice(8, 10)}.${date.slice(5, 7)}.`
  const relative =
    date === today ? 'Heute' : date === addDays(today, -1) ? 'Gestern' : date === addDays(today, 1) ? 'Morgen' : null
  return { date: date.slice(0, 4) === today.slice(0, 4) ? text : `${text}${date.slice(0, 4)}`, relative }
}

/** „2026-10“ → „Oktober 2026“ */
export function monthLabel(month: string): string {
  return `${MONTHS[Number(month.slice(5, 7)) - 1] ?? ''} ${month.slice(0, 4)}`
}

/** Monat ± n: „2026-12“ + 1 → „2027-01“ */
export function addMonths(month: string, by: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + by
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** Felder des Monatskalenders ab Montag; null = leeres Feld vor dem 1. bzw. nach dem Letzten */
export function monthGrid(month: string): (LocalDate | null)[] {
  const first = `${month}-01`
  const cells: (LocalDate | null)[] = Array.from({ length: weekdayIndex(first) }, () => null)
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** „1 Eintrag“ / „11 Einträge“ */
export function entryCount(n: number): string {
  return `${formatNumber(n)} ${n === 1 ? 'Eintrag' : 'Einträge'}`
}

/** Summe mit „mind.“, wenn ein Teil unbekannt ist; ganz unbekannt = „–“ */
export function formatSum(sum: NutrientSum, decimals = 0): string {
  const text = formatNumber(sum.value, decimals)
  return sum.atLeast ? `mind. ${text}` : text
}

export interface DaySlot {
  slot: Slot
  entries: Entry[]
  kcal: NutrientSum
}

/**
 * Slots des Tages: aktive in ihrer Reihenfolge, dazu archivierte nur, wenn sie an diesem Tag Einträge haben.
 * Einträge ohne bekannten Slot (z. B. nach einem Import) landen im ersten Slot, damit nichts verschwindet.
 */
export function slotsForDay(slots: readonly Slot[], entries: readonly Entry[]): DaySlot[] {
  const live = slots.filter((s) => s.deletedAt === null)
  const used = new Set(entries.map((e) => e.slotId))
  const shown = live
    .filter((s) => !s.archived || used.has(s.id))
    .sort((a, b) => Number(a.archived) - Number(b.archived) || a.order - b.order)
  const ids = new Set(shown.map((s) => s.id))
  const first = shown[0]?.id
  const bySlot = new Map<string, Entry[]>()
  const ordered = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (const e of ordered) {
    const id = ids.has(e.slotId) ? e.slotId : first
    if (id === undefined) continue
    bySlot.set(id, [...(bySlot.get(id) ?? []), e])
  }
  return shown.map((slot) => {
    const list = bySlot.get(slot.id) ?? []
    return { slot, entries: list, kcal: sumNutrients(list.map((e) => e.nutrients)).kcal }
  })
}

/** kcal je Tag aus Einträgen (bekannte Werte, ohne gelöschte) */
export function kcalByDate(entries: readonly Entry[]): Record<LocalDate, number> {
  const result: Record<LocalDate, number> = {}
  for (const e of entries) {
    if (e.deletedAt !== null) continue
    result[e.date] = (result[e.date] ?? 0) + (e.nutrients.kcal ?? 0)
  }
  return result
}

export type OverviewMacroKey = 'protein' | 'carbs' | 'fat' | 'fiber'

export interface OverviewMacro {
  key: OverviewMacroKey
  label: string
  eaten: NutrientSum
  /** Tagesziel in g; null = ohne Ziel */
  goal: number | null
}

export interface DayOverview {
  /** Dynamisches Tagesziel; null = vor dem ersten Profil */
  target: number | null
  eaten: NutrientSum
  /** Ziel − gegessen; negativ = drüber */
  remaining: number | null
  over: boolean
  /** Anteil gegessen am Ziel für den Ring, 0–1 */
  progress: number
  macros: OverviewMacro[]
  week: WeekStatus | null
}

export interface DayGoalInput {
  version: Pick<ProfileVersion, 'weeklyKcal' | 'protein' | 'fat' | 'carbs' | 'fiberG' | 'manualWeightKg'>
  weekBudget: number
  countFrom: LocalDate | null
}

// Reihenfolge wie in Kern.dc.html / Leer.dc.html
const OVERVIEW_MACROS: readonly { key: OverviewMacroKey; label: string }[] = [
  { key: 'protein', label: 'Eiweiß' },
  { key: 'carbs', label: 'Kohlenhydrate' },
  { key: 'fat', label: 'Fett' },
  { key: 'fiber', label: 'Ballaststoffe' },
]

/**
 * Übersichtskarte eines Tages. dayEntries = Einträge des Tages, weekKcal = kcal je Tag der Woche.
 * Gewicht für g/kg ist bis Phase 9 das manuelle Gewicht im Profil.
 */
export function dayOverview(
  date: LocalDate,
  today: LocalDate,
  dayEntries: readonly Entry[],
  weekKcal: KcalByDate,
  goal: DayGoalInput | null,
): DayOverview {
  const sums = sumNutrients(dayEntries.map((e) => e.nutrients))
  const eaten = sums.kcal
  const kcal = eaten.value ?? 0

  let target: number | null = null
  let grams: Partial<Record<OverviewMacroKey, number | null>> = {}
  let week: WeekStatus | null = null
  if (goal) {
    const options = { countFrom: goal.countFrom, weeklyKcal: goal.version.weeklyKcal }
    target = dynamicTargetFor(date, today, weekKcal, goal.weekBudget, options)
    week = weekStatus(date, today, weekKcal, goal.weekBudget, options)
    grams = { ...macroGoals(goal.version, goal.version.manualWeightKg).grams, fiber: goal.version.fiberG }
  }

  const remaining = target === null ? null : target - kcal
  const over = remaining !== null && remaining < 0
  const progress = target === null ? 0 : target <= 0 ? 1 : Math.min(1, kcal / target)

  return {
    target,
    eaten,
    remaining,
    over,
    progress,
    macros: OVERVIEW_MACROS.map(({ key, label }) => ({ key, label, eaten: sums[key], goal: grams[key] ?? null })),
    week,
  }
}

/**
 * Höhe der Wochenbalken: Maßstab so, dass das feste Tagesziel bei 7/8 der Höhe liegt
 * (Prototyp: 2.800 von 3.200), höhere Tage strecken den Maßstab.
 */
export function weekBarScale(week: WeekStatus): number {
  const max = Math.max(...week.days.map((d) => d.kcal), 0)
  return Math.max(week.fixedTarget / 0.875, max, 1)
}
