// Gewichtskarte der Statistik (Statistik.dc.html „Gewicht“): Messpunkte grau, Trendlinie blau. Reine Funktionen.
// Der Trend läuft nur bis zur letzten Wiegung; danach würde er nur waagrecht weitergezeichnet.

import type { LocalDate } from '../db/types.ts'
import { daysBetween } from './dates.ts'
import { dailyTrend, firstPerDay, type WeightSample } from './estimate.ts'
import { formatNumber } from './format.ts'
import type { StatsRange } from './stats.ts'

/** Ganzer Zeitraum mit Trend: „+0,5 kg in 4 Wochen“ */
const RANGE_TEXT: Readonly<Record<StatsRange, string>> = {
  week: 'diese Woche',
  month: 'in 4 Wochen',
  quarter: 'in 3 Monaten',
}
/** Achse auf halbe kg, mindestens 1 kg hoch */
const STEP = 0.5
const MIN_SPAN = 1

export interface ChartPoint {
  /** 0–1, Mitte der Tagesspalte (wie die Balken darüber) */
  x: number
  kg: number
}

export interface WeightChart {
  /** kg an der unteren und oberen Linie */
  min: number
  max: number
  measured: ChartPoint[]
  trend: ChartPoint[]
  /** „+0,5 kg in 4 Wochen“; null = Trend kürzer als 2 Tage */
  changeText: string | null
  /** Text für VoiceOver */
  label: string
}

/** null = im Zeitraum weder Wiegung noch Trend */
export function weightChart(
  dates: readonly LocalDate[],
  today: LocalDate,
  weights: readonly WeightSample[],
  range: StatsRange,
): WeightChart | null {
  const first = dates[0]
  if (!first) return null
  const x = (date: LocalDate) => (daysBetween(first, date) + 0.5) / dates.length
  const inRange = (date: LocalDate) => date >= first && date <= (dates[dates.length - 1] as LocalDate) && date <= today

  const weighings = firstPerDay(weights).filter((w) => w.date <= today)
  const last = weighings[weighings.length - 1]
  const measured = weighings.filter((w) => inRange(w.date)).map((w) => ({ x: x(w.date), kg: w.kg }))
  const trendPoints = dailyTrend(weighings, today).filter((p) => inRange(p.date) && last && p.date <= last.date)
  const trend = trendPoints.map((p) => ({ x: x(p.date), kg: p.trend }))
  if (measured.length === 0 && trend.length === 0) return null

  const all = [...measured, ...trend].map((p) => p.kg)
  let min = Math.floor(Math.min(...all) / STEP) * STEP
  let max = Math.ceil(Math.max(...all) / STEP) * STEP
  // Zu flach wirkt jede Schwankung riesig: mindestens 1 kg, möglichst mittig
  if (max - min < MIN_SPAN) {
    const extra = MIN_SPAN - (max - min)
    const below = Math.floor(extra / STEP / 2) * STEP
    min -= below
    max += extra - below
  }

  const from = trendPoints[0]
  const to = trendPoints[trendPoints.length - 1]
  let changeText: string | null = null
  if (from && to && from.date !== to.date) {
    const change = to.trend - from.trend
    const kg = formatNumber(change, 1)
    const sign = change > 0 && kg !== '0,0' ? '+' : ''
    const whole = from.date === first && to.date === today
    const days = daysBetween(from.date, to.date)
    changeText = `${sign}${kg} kg ${whole ? RANGE_TEXT[range] : `in ${formatNumber(days)} ${days === 1 ? 'Tag' : 'Tagen'}`}`
  }
  const label =
    from && to
      ? `Gewichtstrend von ${formatNumber(from.trend, 1)} auf ${formatNumber(to.trend, 1)} Kilogramm, ${formatNumber(measured.length)} Wiegungen`
      : `${formatNumber(measured.length)} Wiegungen`

  return { min, max, measured, trend, changeText, label }
}
