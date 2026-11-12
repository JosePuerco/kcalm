// Tagesziele als zusätzliche Ansicht für das Dashboard (Phase 14b, Jan 12.11.2026).
// Bewusste Ausnahme von „nur Rohdaten“: Das dynamische Tagesziel ist knifflig (Wechsel mitten in der Woche,
// weekBudgetOverride, Tage vor dem ersten Profil), deshalb rechnet Kcalm es einmal mit denselben Funktionen wie
// das Tagebuch und sendet das Ergebnis mit. Lokal wird nichts davon gespeichert.
// Werte exakt, ungerundet; runden darf erst die Anzeige im Dashboard.

import type { Entry, LocalDate, ProfileAssignment, ProfileVersion, Weight } from '../db/types.ts'
import { addDays, weekDates } from './dates.ts'
import { kcalByDate } from './diary.ts'
import { dailyTrend, type WeightSample } from './estimate.ts'
import { dynamicTargetFor, fixedDailyTarget, macroGoals } from './goals.ts'
import { goalFor } from './profiles.ts'
import { diffRows, TARGETS_TABLE, type PushChange, type PushReceipt } from './push.ts'

export interface DailyTarget {
  /** Lokales Datum, zugleich id in der Quittungsliste */
  date: LocalDate
  profileId: string
  profileVersionId: string
  /** Wochenbudget der Version */
  weeklyKcal: number
  /** Wochenbudget, das an diesem Tag gilt (nach „ab heute“-Wechsel anteilig) */
  weekBudget: number
  /** Wochenbudget der Version ÷ 7 */
  fixedTarget: number
  /** Wie im Tagebuch: (Wochenbudget − Vortage) ÷ verbleibende Tage; kann negativ sein */
  dynamicTarget: number
  /** Makroziele in g pro Tag; null = nicht berechenbar (g/kg ohne Gewicht) bzw. kein Ziel */
  proteinG: number | null
  fatG: number | null
  carbsG: number | null
  fiberG: number | null
  /** Gewicht für g/kg: Trendgewicht an dem Tag, sonst das manuelle aus dem Profil; null = keins */
  weightKg: number | null
}

export interface TargetInput {
  assignments: readonly ProfileAssignment[]
  versions: readonly ProfileVersion[]
  /** Alle Einträge; gelöschte werden ignoriert */
  entries: readonly Entry[]
  /** Alle Wiegungen; gelöschte werden ignoriert */
  weights: readonly Weight[]
  /** Verbrauchsschätzung an: nur dann zählt das Trendgewicht (wie im Tagebuch) */
  estimateEnabled: boolean
  today: LocalDate
}

/**
 * Trendgewicht je Tag so, wie das Tagebuch es zeigt: Trend bis einschließlich dieses Tages
 * (`loadGoalTrend(date)`), spätere Wiegungen zählen nicht. Ein Trend bis heute würde Lücken mit späteren
 * Wiegungen auffüllen und für vergangene Tage andere g/kg-Ziele liefern.
 *
 * Schnell statt für jeden Tag neu: Bis zur letzten Wiegung W ≤ Tag rechnen „Trend bis Tag“ und „Trend bis
 * heute“ identisch (dieselben Wiegungen), danach bleibt der Trend bis zum Tag stehen. Also gilt der Wert
 * des Gesamttrends an W. (Gegenprobe im Test gegen dailyTrend je Tag.)
 */
export function trendByDay(samples: readonly WeightSample[], until: LocalDate): (date: LocalDate) => number | null {
  const points = dailyTrend(samples, until)
  const atWeighing = new Map<LocalDate, number>()
  const weighingDates: LocalDate[] = []
  for (const p of points) {
    if (p.kg === null) continue
    atWeighing.set(p.date, p.trend)
    weighingDates.push(p.date)
  }
  return (date) => {
    // Letzte Wiegung ≤ date per Binärsuche
    let lo = 0
    let hi = weighingDates.length - 1
    let found: LocalDate | null = null
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const d = weighingDates[mid] as LocalDate
      if (d <= date) {
        found = d
        lo = mid + 1
      } else hi = mid - 1
    }
    return found === null ? null : (atWeighing.get(found) as number)
  }
}

/** Zeitraum: erster Tag mit Profil bis Sonntag der laufenden Woche; null = (noch) kein Profil */
export function targetRange(
  assignments: readonly Pick<ProfileAssignment, 'validFrom' | 'deletedAt'>[],
  today: LocalDate,
): { from: LocalDate; to: LocalDate } | null {
  const to = weekDates(today)[6] as LocalDate
  let from: LocalDate | null = null
  for (const a of assignments) if (a.deletedAt === null && (from === null || a.validFrom < from)) from = a.validFrom
  if (from === null || from > to) return null
  return { from, to }
}

/** Tagesziele aller Tage im Zeitraum; Tage ohne gültiges Profil fehlen */
export function dailyTargets(input: TargetInput): DailyTarget[] {
  const range = targetRange(input.assignments, input.today)
  if (!range) return []
  const byDate = kcalByDate(input.entries)
  const samples = input.estimateEnabled ? input.weights.filter((w) => w.deletedAt === null) : []
  const trendKg = trendByDay(samples, range.to)
  const rows: DailyTarget[] = []
  for (let date = range.from; date <= range.to; date = addDays(date, 1)) {
    const goal = goalFor(input.assignments, input.versions, date)
    if (!goal) continue
    const { version } = goal
    const weightKg = trendKg(date) ?? version.manualWeightKg
    const macros = macroGoals(version, weightKg).grams
    rows.push({
      date,
      profileId: version.profileId,
      profileVersionId: version.id,
      weeklyKcal: version.weeklyKcal,
      weekBudget: goal.weekBudget,
      fixedTarget: fixedDailyTarget(version.weeklyKcal),
      dynamicTarget: dynamicTargetFor(date, input.today, byDate, goal.weekBudget, {
        countFrom: goal.countFrom,
      }),
      proteinG: macros.protein,
      fatG: macros.fat,
      carbsG: macros.carbs,
      fiberG: version.fiberG,
      weightKg,
    })
  }
  return rows
}

/** Geänderte Tagesziele gegenüber der Quittungsliste; weggefallene Tage als „entfernt“ */
export function pendingTargetChanges(rows: readonly DailyTarget[], receipts: readonly PushReceipt[]): PushChange[] {
  return diffRows([{ table: TARGETS_TABLE, rows }], receipts, (r) => (r as DailyTarget).date)
}
