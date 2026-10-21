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
  /** Erster Tag mit Profil, wenn er in dieser Woche liegt; Tage davor zählen nicht gegen das Budget */
  countFrom: LocalDate | null
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
  const first = assignments.reduce<LocalDate | null>(
    (min, a) => (a.deletedAt === null && (min === null || a.validFrom < min) ? a.validFrom : min),
    null,
  )
  const countFrom = first !== null && weekStart(first) === weekStart(date) ? first : null
  return { assignment, version, weekBudget, countFrom }
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

type VersionRef = Pick<ProfileVersion, 'id' | 'profileId' | 'createdAt' | 'deletedAt'>

/** Neueste Version eines Profils (Bearbeiten legt neue an) */
export function latestVersion<V extends VersionRef>(versions: readonly V[], profileId: string): V | null {
  let best: V | null = null
  for (const v of versions) {
    if (v.deletedAt !== null || v.profileId !== profileId) continue
    if (!best || v.createdAt > best.createdAt) best = v
  }
  return best
}

export interface ProfileStatus {
  /** Profil, das heute gilt */
  activeProfileId: string | null
  /** Erster Tag der laufenden Strecke dieses Profils („Aktiv seit Mo 01.09.2026“) */
  activeSince: LocalDate | null
  /** Nächster geplanter Wechsel nach heute */
  scheduled: (Assignment & { id: string; profileId: string }) | null
}

/** Welches Profil gilt heute, seit wann, und ist ein Wechsel geplant? */
export function profileStatus(
  assignments: readonly (Assignment & { id: string })[],
  versions: readonly VersionRef[],
  today: LocalDate,
): ProfileStatus {
  const profileOf = new Map(versions.map((v) => [v.id, v.profileId]))
  const live = assignments
    .filter((a) => a.deletedAt === null && profileOf.has(a.profileVersionId))
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom) || a.createdAt.localeCompare(b.createdAt))

  const current = assignmentFor(live, today)
  const activeProfileId = current ? (profileOf.get(current.profileVersionId) ?? null) : null

  // Rückwärts, solange dasselbe Profil gilt; je Startdatum zählt nur die zuletzt angelegte Zuweisung
  let activeSince: LocalDate | null = null
  if (current) {
    const past = live.filter((a) => a.validFrom <= today)
    const winners = past.filter((a, i) => past[i + 1]?.validFrom !== a.validFrom)
    for (let i = winners.length - 1; i >= 0; i--) {
      const a = winners[i]!
      if (profileOf.get(a.profileVersionId) !== activeProfileId) break
      activeSince = a.validFrom
    }
  }

  const future = live.filter((a) => a.validFrom > today)
  const firstDate = future[0]?.validFrom
  const next = future.filter((a) => a.validFrom === firstDate).at(-1)
  const scheduled = next ? { ...next, profileId: profileOf.get(next.profileVersionId) as string } : null

  return { activeProfileId, activeSince, scheduled }
}

type Targets = Pick<ProfileVersion, 'weeklyKcal' | 'protein' | 'fat' | 'carbs' | 'fiberG' | 'waterMl' | 'manualWeightKg'>

/** Haben sich die Ziele geändert? Nur dann braucht es eine neue Version (Umbenennen allein nicht) */
export function targetsChanged(a: Targets, b: Targets): boolean {
  const same = (x: { mode: string; value: number | null }, y: { mode: string; value: number | null }) =>
    x.mode === y.mode && x.value === y.value
  return (
    a.weeklyKcal !== b.weeklyKcal ||
    !same(a.protein, b.protein) ||
    !same(a.fat, b.fat) ||
    !same(a.carbs, b.carbs) ||
    a.fiberG !== b.fiberG ||
    a.waterMl !== b.waterMl ||
    a.manualWeightKg !== b.manualWeightKg
  )
}
