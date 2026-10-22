// Daten für den Statistik-Screen in einer Abfrage: Einträge und vollständige Tage des Zeitraums, Profile.

import { buildStats, statsDates, type Stats, type StatsRange } from '../logic/stats.ts'
import { db } from './db.ts'
import type { LocalDate } from './types.ts'

export async function loadStats(today: LocalDate, range: StatsRange): Promise<Stats> {
  const dates = statsDates(today, range)
  const from = dates[0] as LocalDate
  const to = dates[dates.length - 1] as LocalDate
  const [entries, days, assignments, versions] = await Promise.all([
    db.entries.where('date').between(from, to, true, true).filter((e) => e.deletedAt === null).toArray(),
    db.days.where('date').between(from, to, true, true).filter((d) => d.deletedAt === null && d.complete).toArray(),
    db.profileAssignments.toArray(),
    db.profileVersions.toArray(),
  ])
  return buildStats(range, { today, entries, completeDates: new Set(days.map((d) => d.date)), assignments, versions })
}
