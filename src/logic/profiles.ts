// Welches Profil an welchem Tag gilt und wie ein Wechsel das Wochenbudget setzt.
// Snapshot-Prinzip: Zuweisungen haben ein Startdatum; vergangene Tage behalten ihre damalige Version.

import type { LocalDate, ProfileAssignment, ProfileVersion } from '../db/types.ts'
import { daysLeftInWeek, nextMonday, weekStart, weekdayIndex } from './dates.ts'

type Assignment = Pick<ProfileAssignment, 'validFrom' | 'profileVersionId' | 'weekBudgetOverride' | 'createdAt' | 'deletedAt'>

/**
 * Zuweisung, die am Datum gilt: die mit dem spätesten validFrom ≤ Datum.
 * Gleiches Startdatum: die zuletzt angelegte gewinnt (z. B. Wechsel für Montag zweimal geändert).
 */
export function assignmentFor<T extends Assignment>(assignments: readonly T[], date: LocalDate): T | null {
  let best: T | null = null
  for (const a of assignments) {
    if (a.deletedAt !== null || a.validFrom > date) continue
    if (!best || a.validFrom > best.validFrom || (a.validFrom === best.validFrom && a.createdAt > best.createdAt)) {
      best = a
    }
  }
  return best
}

export interface DayGoal<V> {
  assignment: Assignment
  version: V
  /** Wochenbudget, das an diesem Tag gilt */
  weekBudget: number
}

/**
 * Profil und Wochenbudget eines Tages. Der Override aus „ab heute“ gilt nur in der Woche des Wechsels,
 * danach wieder das normale Wochenbudget der Version. null = vor dem ersten Profil.
 */
export function goalFor<V extends Pick<ProfileVersion, 'id' | 'weeklyKcal'>>(
  assignments: readonly Assignment[],
  versions: readonly V[],
  date: LocalDate,
): DayGoal<V> | null {
  const assignment = assignmentFor(assignments, date)
  if (!assignment) return null
  const version = versions.find((v) => v.id === assignment.profileVersionId)
  if (!version) return null
  const sameWeek = weekStart(assignment.validFrom) === weekStart(date)
  const weekBudget =
    assignment.weekBudgetOverride !== null && sameWeek ? assignment.weekBudgetOverride : version.weeklyKcal
  return { assignment, version, weekBudget }
}

export interface PlannedSwitch {
  validFrom: LocalDate
  weekBudgetOverride: number | null
}

/** „Ab nächstem Montag“ (Standard): die laufende Woche bleibt beim alten Profil */
export function switchFromNextMonday(today: LocalDate): PlannedSwitch {
  return { validFrom: nextMonday(today), weekBudgetOverride: null }
}

/**
 * „Ab heute“: Wochenbudget dieser Woche = neues Budget × verbleibende Tage ÷ 7 + bisheriger Verbrauch.
 * Beispiel Wechsel Do auf 15.400, Mo–Mi 8.900: 15.400 × 4 ÷ 7 + 8.900 = 17.700.
 * consumedBefore = Verbrauch der Vortage dieser Woche (ohne heute).
 * An einem Montag ist das genau das neue Budget, dann braucht es keinen Override.
 */
export function switchFromToday(today: LocalDate, newWeeklyKcal: number, consumedBefore: number): PlannedSwitch {
  if (weekdayIndex(today) === 0) return { validFrom: today, weekBudgetOverride: null }
  return {
    validFrom: today,
    weekBudgetOverride: (newWeeklyKcal * daysLeftInWeek(today)) / 7 + consumedBefore,
  }
}
