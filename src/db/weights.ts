// Gewichte für Verbrauchsschätzung und g/kg-Ziele. Sie kommen seit Phase 16.2 nur noch aus Garmin
// (Abgleich in garminWeights.ts); ein Wert pro Tag.

import { dailyTrend, trendAt, type TrendPoint } from '../logic/estimate.ts'
import { db } from './db.ts'
import { getSetting, setSetting } from './settings.ts'
import { ESTIMATE_KEY } from './setup.ts'
import type { LocalDate, Weight } from './types.ts'

export async function getEstimateEnabled(): Promise<boolean> {
  return (await getSetting<boolean>(ESTIMATE_KEY)) === true
}

export async function setEstimateEnabled(enabled: boolean, now = new Date()): Promise<void> {
  // Ausschalten löscht keine Gewichte; beim Wiedereinschalten ist alles noch da
  await setSetting(ESTIMATE_KEY, enabled, now)
}

/** Nicht gelöschte Gewichte, nach Datum sortiert */
export async function getWeights(): Promise<Weight[]> {
  const all = await db.weights.orderBy('date').toArray()
  return all.filter((w) => w.deletedAt === null)
}

/** Trend für g/kg-Makros bis `today`; leer, wenn die Verbrauchsschätzung aus ist (dann gilt das manuelle Gewicht) */
export async function loadGoalTrend(today: LocalDate): Promise<TrendPoint[]> {
  if (!(await getEstimateEnabled())) return []
  return dailyTrend(await getWeights(), today)
}

/** Heutiges Trendgewicht für das Profilformular; null = Schätzung aus oder noch keine Wiegung */
export async function currentTrendKg(today: LocalDate): Promise<number | null> {
  return trendAt(await loadGoalTrend(today), today)
}
