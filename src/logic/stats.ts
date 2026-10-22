// Werte für den Statistik-Screen (Statistik.dc.html). Reine Funktionen; die Oberfläche zeigt nur an.
// Regeln: PLAN.md Abschnitt 7 „Statistik: …“. Ø, Bilanz und Makros nur über vollständige Tage;
// Tage ohne Einträge zählen nirgends; Zeiträume immer ganze Wochen Mo–So.

import type { Entry, LocalDate, ProfileAssignment, ProfileVersion } from '../db/types.ts'
import { addDays, isoWeek, weekStart } from './dates.ts'
import { dayLabel, type OverviewMacroKey } from './diary.ts'
import { formatNumber } from './format.ts'
import { fixedDailyTarget, macroGoals } from './goals.ts'
import { sumNutrients, type NutrientSum } from './nutrients.ts'
import { goalFor } from './profiles.ts'

export type StatsRange = 'week' | 'month' | 'quarter'

/** Wochen je Zeitraum, jeweils bis einschließlich der laufenden */
const RANGE_WEEKS: Readonly<Record<StatsRange, number>> = { week: 1, month: 4, quarter: 13 }

/** Ab so vielen vollständigen Tagen gilt eine Woche als vollständig (Ansicht 3 Monate) */
export const FULL_WEEK_MIN_DAYS = 5

/**
 * complete = Einträge und als vollständig markiert; incomplete = Einträge, nicht markiert;
 * empty = keine Einträge (auch wenn markiert); future = nach heute, zählt nie
 */
export type DayState = 'complete' | 'incomplete' | 'empty' | 'future'

export interface DayGoalValues {
  /** Festes Tagesziel (Wochenbudget ÷ 7) der damals gültigen Version */
  kcal: number
  /** Gramm pro Tag; null = ohne Ziel bzw. nicht berechenbar */
  macros: Record<OverviewMacroKey, number | null>
}

export interface StatsDay {
  date: LocalDate
  state: DayState
  kcal: NutrientSum
  macros: Record<OverviewMacroKey, NutrientSum>
  /** null = vor dem ersten Profil */
  goal: DayGoalValues | null
}

type Assignment = Pick<ProfileAssignment, 'validFrom' | 'profileVersionId' | 'weekBudgetOverride' | 'createdAt' | 'deletedAt'>
type Version = Pick<ProfileVersion, 'id' | 'weeklyKcal' | 'protein' | 'fat' | 'carbs' | 'fiberG' | 'manualWeightKg'>

export const STATS_MACROS: readonly { key: OverviewMacroKey; label: string }[] = [
  { key: 'protein', label: 'Eiweiß' },
  { key: 'carbs', label: 'Kohlenhydrate' },
  { key: 'fat', label: 'Fett' },
  { key: 'fiber', label: 'Ballaststoffe' },
]

/** Alle Tage des Zeitraums, Montag der ersten Woche bis Sonntag der laufenden */
export function statsDates(today: LocalDate, range: StatsRange): LocalDate[] {
  const weeks = RANGE_WEEKS[range]
  const first = addDays(weekStart(today), -7 * (weeks - 1))
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i))
}

/** Ziel eines Tages aus dem damals gültigen Profil. Gewicht für g/kg ist bis Phase 9 das manuelle. */
export function dayGoal(assignments: readonly Assignment[], versions: readonly Version[], date: LocalDate): DayGoalValues | null {
  const goal = goalFor(assignments, versions, date)
  if (!goal) return null
  const { version } = goal
  const grams = macroGoals(version, version.manualWeightKg).grams
  return {
    kcal: fixedDailyTarget(version.weeklyKcal),
    macros: { protein: grams.protein, carbs: grams.carbs, fat: grams.fat, fiber: version.fiberG },
  }
}

export interface StatsInput {
  today: LocalDate
  dates: readonly LocalDate[]
  /** nicht gelöschte Einträge; andere Tage werden ignoriert */
  entries: readonly Entry[]
  completeDates: ReadonlySet<LocalDate>
  assignments: readonly Assignment[]
  versions: readonly Version[]
}

export function statsDays(input: StatsInput): StatsDay[] {
  const byDate = new Map<LocalDate, Entry[]>()
  for (const e of input.entries) {
    const list = byDate.get(e.date)
    if (list) list.push(e)
    else byDate.set(e.date, [e])
  }
  return input.dates.map((date) => {
    const entries = byDate.get(date) ?? []
    const sums = sumNutrients(entries.map((e) => e.nutrients))
    const state: DayState =
      date > input.today
        ? 'future'
        : entries.length === 0
          ? 'empty'
          : input.completeDates.has(date)
            ? 'complete'
            : 'incomplete'
    return {
      date,
      state,
      kcal: sums.kcal,
      macros: { protein: sums.protein, carbs: sums.carbs, fat: sums.fat, fiber: sums.fiber },
      goal: dayGoal(input.assignments, input.versions, date),
    }
  })
}

/** Durchschnitt mehrerer Summen; „mind.“, sobald eine davon unvollständig ist. Leere Liste → null. */
export function averageSums(sums: readonly NutrientSum[]): NutrientSum | null {
  if (sums.length === 0) return null
  let total = 0
  let known = 0
  let atLeast = false
  for (const s of sums) {
    if (s.value === null) {
      atLeast = true
      continue
    }
    total += s.value
    known++
    if (s.atLeast) atLeast = true
  }
  // Alle Werte unbekannt: Durchschnitt unbekannt
  if (known === 0) return { value: null, atLeast: false }
  // Unbekannte Tage zählen als 0 mit; ihr wahrer Wert liegt darüber, deshalb „mind.“
  return { value: total / sums.length, atLeast }
}

function average(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length
}

export interface StatsTiles {
  /** Ø kcal der vollständigen Tage; null = keine vollständigen Tage */
  avgKcal: NutrientSum | null
  completeDays: number
  /** Tage mit Einträgen bis heute */
  trackedDays: number
  /** Ø (kcal − Tagesziel) der vollständigen Tage mit Profil; negativ = unter dem Ziel */
  balance: NutrientSum | null
}

export function statsTiles(days: readonly StatsDay[]): StatsTiles {
  const complete = days.filter((d) => d.state === 'complete')
  const withGoal = complete.filter((d) => d.goal !== null)
  return {
    avgKcal: averageSums(complete.map((d) => d.kcal)),
    completeDays: complete.length,
    trackedDays: days.filter((d) => d.state === 'complete' || d.state === 'incomplete').length,
    balance: averageSums(
      withGoal.map((d) => ({
        value: d.kcal.value === null ? null : d.kcal.value - (d.goal as DayGoalValues).kcal,
        atLeast: d.kcal.atLeast,
      })),
    ),
  }
}

export interface StatsMacro {
  key: OverviewMacroKey
  label: string
  /** Ø pro Tag der vollständigen Tage; null = keine */
  eaten: NutrientSum | null
  /** Ø der Tagesziele der vollständigen Tage mit Profil; null = ohne Ziel */
  goal: number | null
  /** eaten ÷ goal, ungekappt (1,08 = 108 %); null = nicht berechenbar */
  ratio: number | null
}

export function macroAverages(days: readonly StatsDay[]): StatsMacro[] {
  const complete = days.filter((d) => d.state === 'complete')
  const withGoal = complete.filter((d) => d.goal !== null)
  return STATS_MACROS.map(({ key, label }) => {
    const eaten = averageSums(complete.map((d) => d.macros[key]))
    const goals = withGoal.map((d) => (d.goal as DayGoalValues).macros[key])
    // Fehlt das Ziel an einem Tag (z. B. Ballaststoffe nicht gesetzt), gibt es keinen sinnvollen Ø
    const goal = goals.some((g) => g === null) ? null : average(goals as number[])
    const ratio = eaten?.value != null && goal !== null && goal > 0 ? eaten.value / goal : null
    return { key, label, eaten, goal, ratio }
  })
}

export interface StatsBar {
  /** erster Tag des Balkens (Tag bzw. Montag der Woche) */
  date: LocalDate
  /** Beschriftung unter dem Balken; leer = keine */
  label: string
  /** kcal (Tag) bzw. Ø kcal/Tag der vollständigen Tage (Woche); null = kein Balken */
  kcal: NutrientSum | null
  /** vollständig = accent, sonst neutralBar */
  full: boolean
  /** nur Wochen: vollständige Tage */
  completeDays: number | null
  /** Text oben rechts beim Antippen und für VoiceOver */
  caption: string
}

function shortDate(date: LocalDate): string {
  return `${Number(date.slice(8, 10))}.${Number(date.slice(5, 7))}.`
}

function kcalText(sum: NutrientSum): string {
  return `${sum.atLeast ? 'mind. ' : ''}${formatNumber(sum.value)} kcal`
}

/** Ein Balken je Tag (Woche, 4 Wochen). Unvollständige Tage grau, leere und künftige ohne Balken. */
export function dayBars(days: readonly StatsDay[], today: LocalDate): StatsBar[] {
  const single = days.length <= 7
  return days.map((d, i) => {
    const name = dayLabel(d.date, today).date
    const has = d.state === 'complete' || d.state === 'incomplete'
    const caption = has
      ? `${name}: ${kcalText(d.kcal)}${d.state === 'incomplete' ? ' · unvollständig' : ''}`
      : `${name}: ${d.state === 'future' ? 'noch offen' : 'keine Einträge'}`
    return {
      date: d.date,
      // 4 Wochen: nur die Montage beschriften
      label: single ? name.slice(0, 2) : i % 7 === 0 ? shortDate(d.date) : '',
      kcal: has ? d.kcal : null,
      full: d.state === 'complete',
      completeDays: null,
      caption,
    }
  })
}

/**
 * Ein Balken je Woche (3 Monate): Ø der vollständigen Tage. Blau ab 5 von 7 vollständigen Tagen;
 * die laufende Woche ist blau, solange alle bisherigen Tage mit Einträgen vollständig sind
 * (heute zählt erst, wenn er markiert ist).
 */
export function weekBars(days: readonly StatsDay[], today: LocalDate): StatsBar[] {
  const bars: StatsBar[] = []
  for (let i = 0; i < days.length; i += 7) {
    const week = days.slice(i, i + 7)
    const monday = (week[0] as StatsDay).date
    const complete = week.filter((d) => d.state === 'complete')
    const current = monday === weekStart(today)
    const openBefore = week.some((d) => d.state === 'incomplete' && d.date < today)
    const full =
      complete.length >= FULL_WEEK_MIN_DAYS || (current && complete.length > 0 && !openBefore)
    const kcal = averageSums(complete.map((d) => d.kcal))
    const name = `KW ${isoWeek(monday)}`
    bars.push({
      date: monday,
      label: `KW${isoWeek(monday)}`,
      kcal,
      full,
      completeDays: complete.length,
      caption: kcal
        ? `${name}: Ø ${kcalText(kcal)} · ${complete.length} von 7 Tagen vollständig`
        : `${name}: keine vollständigen Tage`,
    })
  }
  return bars
}

/**
 * Maßstab der Balken (kcal am oberen Rand): Ziellinie bei 7/8 der Höhe, höhere Balken strecken ihn.
 * Wie weekBarScale in der Tagesansicht.
 */
export function barScale(bars: readonly StatsBar[], goal: number | null): number {
  const max = Math.max(...bars.map((b) => b.kcal?.value ?? 0), 0)
  return Math.max(goal === null ? 0 : goal / 0.875, max, 1)
}

/** Balken unter dem Finger: x relativ zur Diagrammfläche, außerhalb wird auf den Rand begrenzt */
export function nearestBar(x: number, width: number, count: number): number {
  if (count <= 0 || width <= 0) return -1
  const i = Math.floor((x / width) * count)
  return Math.min(count - 1, Math.max(0, i))
}

export interface Stats {
  range: StatsRange
  tiles: StatsTiles
  bars: StatsBar[]
  /** aktuelles festes Tagesziel für die gestrichelte Linie; null = kein Profil */
  goalLine: number | null
  scale: number
  macros: StatsMacro[]
}

/** Alles für den Screen aus den Rohdaten des Zeitraums */
export function buildStats(range: StatsRange, input: Omit<StatsInput, 'dates'>): Stats {
  const days = statsDays({ ...input, dates: statsDates(input.today, range) })
  const bars = range === 'quarter' ? weekBars(days, input.today) : dayBars(days, input.today)
  const goalLine = dayGoal(input.assignments, input.versions, input.today)?.kcal ?? null
  return {
    range,
    tiles: statsTiles(days),
    bars,
    goalLine,
    scale: barScale(bars, goalLine),
    macros: macroAverages(days),
  }
}
