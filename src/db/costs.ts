// Kostenauswertung (Phase 13): Schalter in den Einstellungen (Ausschalten löscht keine Preise) und
// Daten für den Abschnitt „Kosten“ in der Statistik.

import { buildCostStats, priceLookup, type CostStats } from '../logic/cost.ts'
import { statsDates, type StatsRange } from '../logic/stats.ts'
import { db } from './db.ts'
import { getSetting, setSetting } from './settings.ts'
import type { LocalDate } from './types.ts'

export const COSTS_KEY = 'costsEnabled'

export async function getCostsEnabled(): Promise<boolean> {
  return (await getSetting<boolean>(COSTS_KEY)) === true
}

export async function setCostsEnabled(enabled: boolean, now = new Date()): Promise<void> {
  await setSetting(COSTS_KEY, enabled, now)
}

/** Einträge und vollständige Tage des Zeitraums, Preise aus den aktuellen Produkten, BLS und Rezepten */
export async function loadCostStats(today: LocalDate, range: StatsRange): Promise<CostStats> {
  const dates = statsDates(today, range)
  const from = dates[0] as LocalDate
  const to = dates[dates.length - 1] as LocalDate
  const [entries, days, products, blsPrefs, recipes] = await Promise.all([
    db.entries.where('date').between(from, to, true, true).filter((e) => e.deletedAt === null).toArray(),
    db.days.where('date').between(from, to, true, true).filter((d) => d.deletedAt === null && d.complete).toArray(),
    db.products.toArray(),
    db.blsPrefs.toArray(),
    db.recipes.toArray(),
  ])
  return buildCostStats(range, {
    today,
    entries,
    completeDates: new Set(days.map((d) => d.date)),
    lookup: priceLookup({ products, blsPrefs, recipes }),
  })
}
