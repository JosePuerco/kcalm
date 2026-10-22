// Daten für den Schätz-Screen in einer Abfrage: Tage des Zeitraums, alle Gewichte, aktuelles Budget.

import { estimate, estimateDates, type Estimate, type EstimateDay } from '../logic/estimate.ts'
import { dayGoal, statsDays } from '../logic/stats.ts'
import { db } from './db.ts'
import type { LocalDate, Weight } from './types.ts'

export interface EstimateData {
  estimate: Estimate
  days: EstimateDay[]
  /** Festes Tagesziel des heute gültigen Profils; null = kein Profil */
  budget: number | null
  /** nicht gelöschte Gewichte, nach Datum sortiert */
  weights: Weight[]
}

export async function loadEstimate(today: LocalDate): Promise<EstimateData> {
  const dates = estimateDates(today)
  const from = dates[0] as LocalDate
  const [entries, days, assignments, versions, weights] = await Promise.all([
    db.entries.where('date').between(from, today, true, true).filter((e) => e.deletedAt === null).toArray(),
    db.days.where('date').between(from, today, true, true).filter((d) => d.deletedAt === null && d.complete).toArray(),
    db.profileAssignments.toArray(),
    db.profileVersions.toArray(),
    db.weights.orderBy('date').filter((w) => w.deletedAt === null).toArray(),
  ])
  const statDays = statsDays({ today, dates, entries, completeDates: new Set(days.map((d) => d.date)), assignments, versions })
  return {
    estimate: estimate({ today, days: statDays, weights }),
    days: statDays,
    budget: dayGoal(assignments, versions, today)?.kcal ?? null,
    weights,
  }
}
