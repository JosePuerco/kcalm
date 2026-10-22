// Daten für den Statistik-Screen in einer Abfrage: Einträge und vollständige Tage des Zeitraums, Profile,
// Gewichtstrend für g/kg-Ziele.

import { trendAt } from '../logic/estimate.ts'
import { buildStats, statsDates, type Stats, type StatsRange } from '../logic/stats.ts'
import { db } from './db.ts'
import { loadGoalTrend } from './weights.ts'
import type { LocalDate } from './types.ts'

export async function loadStats(today: LocalDate, range: StatsRange): Promise<Stats> {
  const dates = statsDates(today, range)
  const from = dates[0] as LocalDate
  const to = dates[dates.length - 1] as LocalDate
  const [entries, days, assignments, versions, trend] = await Promise.all([
    db.entries.where('date').between(from, to, true, true).filter((e) => e.deletedAt === null).toArray(),
    db.days.where('date').between(from, to, true, true).filter((d) => d.deletedAt === null && d.complete).toArray(),
    db.profileAssignments.toArray(),
    db.profileVersions.toArray(),
    loadGoalTrend(today),
  ])
  return buildStats(range, {
    today,
    entries,
    completeDates: new Set(days.map((d) => d.date)),
    assignments,
    versions,
    // g/kg-Ziele mit dem Trendgewicht des jeweiligen Tages
    weightAt: (date) => trendAt(trend, date),
  })
}
