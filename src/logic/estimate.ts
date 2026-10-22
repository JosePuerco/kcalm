// Verbrauchsschätzung (Schaetzung.dc.html): Gewichtstrend, geschätzter Verbrauch und Spanne.
// Reine Funktionen; die Oberfläche zeigt nur an. Regeln: PLAN.md Abschnitt 2 „Berechnungen“ und 7.
// Gezählt wird wie in der Statistik: nur vollständige Tage mit Einträgen.

import type { LocalDate, Weight } from '../db/types.ts'
import { addDays, daysBetween } from './dates.ts'
import type { NutrientSum } from './nutrients.ts'
import { averageSums, type StatsDay } from './stats.ts'

/** Glättungsfaktor des Trends: jeder Tag geht mit 10 % ein (wie „The Hacker's Diet“) */
export const TREND_ALPHA = 0.1
/** Energiedichte Körpergewicht, fest (PLAN.md Abschnitt 7) */
export const KCAL_PER_KG = 7700
/** Die Schätzung schaut auf die letzten 28 Tage inklusive heute */
export const ESTIMATE_WINDOW_DAYS = 28
/** Frühestens ab so vielen vollständigen Tagen im Zeitraum */
export const MIN_COMPLETE_DAYS = 14
/** Der Trend muss im Zeitraum mindestens so viele Tage überspannen (erste bis letzte Wiegung) */
export const MIN_TREND_DAYS = 14
/** Mindestens so viele Wiegetage im Zeitraum, sonst ist die Streuung nicht belastbar */
export const MIN_WEIGHINGS = 7
/** Spanne ≈ 95 %: 1,96 Standardfehler */
export const SPREAD_Z = 1.96

export type WeightSample = Pick<Weight, 'date' | 'kg' | 'measuredAt'>

/** Mehrere Wiegungen an einem Tag: die früheste zählt. Ergebnis nach Datum sortiert. */
export function firstPerDay<T extends WeightSample>(samples: readonly T[]): T[] {
  const byDate = new Map<LocalDate, T>()
  for (const s of samples) {
    const prev = byDate.get(s.date)
    if (!prev || Date.parse(s.measuredAt) < Date.parse(prev.measuredAt)) byDate.set(s.date, s)
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

export interface TrendPoint {
  date: LocalDate
  /** geglättetes Gewicht am Ende des Tages */
  trend: number
  /** gemessenes Gewicht (erste Wiegung); null = an dem Tag nicht gewogen */
  kg: number | null
}

/**
 * Trend für jeden Tag von der ersten Wiegung bis `until`. Exponentiell geglättet:
 * trend = trend + α × (Gewicht − trend), Start = erste Wiegung.
 * Lücken zwischen zwei Wiegungen werden linear aufgefüllt, damit seltenes Wiegen den Trend nicht verzerrt.
 * Nach der letzten Wiegung bleibt der Trend stehen (keine Vorhersage). Wiegungen nach `until` zählen nicht.
 */
export function dailyTrend(samples: readonly WeightSample[], until: LocalDate): TrendPoint[] {
  const weighings = firstPerDay(samples).filter((w) => w.date <= until)
  const first = weighings[0]
  if (!first) return []
  const points: TrendPoint[] = []
  let trend = first.kg
  let next = 0
  for (let date = first.date; date <= until; date = addDays(date, 1)) {
    while (next < weighings.length && (weighings[next] as WeightSample).date < date) next++
    const at = weighings[next]
    let value: number | null = null
    let kg: number | null = null
    if (at && at.date === date) {
      value = kg = at.kg
    } else if (at) {
      // Zwischen der vorigen und der nächsten Wiegung linear auffüllen
      const prev = weighings[next - 1] as WeightSample
      const t = daysBetween(prev.date, date) / daysBetween(prev.date, at.date)
      value = prev.kg + (at.kg - prev.kg) * t
    }
    if (value !== null) trend += TREND_ALPHA * (value - trend)
    points.push({ date, trend, kg })
  }
  return points
}

/** Trendgewicht an einem Tag; null = vor der ersten Wiegung */
export function trendAt(points: readonly TrendPoint[], date: LocalDate): number | null {
  const first = points[0]
  if (!first || date < first.date) return null
  const i = daysBetween(first.date, date)
  // Nach dem letzten Punkt gilt der letzte Trend
  return (points[Math.min(i, points.length - 1)] as TrendPoint).trend
}

/** Die Tage des Schätzzeitraums, ältester zuerst, bis einschließlich heute */
export function estimateDates(today: LocalDate): LocalDate[] {
  return Array.from({ length: ESTIMATE_WINDOW_DAYS }, (_, i) => addDays(today, i - ESTIMATE_WINDOW_DAYS + 1))
}

/**
 * Standardfehler der Steigung (kg pro Tag) einer Ausgleichsgeraden durch die Wiegungen.
 * Klein bei wenig Streuung und vielen, weit auseinanderliegenden Wiegungen. null = unter 3 Wiegungen.
 */
export function slopeStandardError(points: readonly { date: LocalDate; kg: number }[]): number | null {
  const n = points.length
  const first = points[0]
  if (!first || n < 3) return null
  const xs = points.map((p) => daysBetween(first.date, p.date))
  const ys = points.map((p) => p.kg)
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < n; i++) {
    sxx += ((xs[i] as number) - mx) ** 2
    sxy += ((xs[i] as number) - mx) * ((ys[i] as number) - my)
  }
  if (sxx === 0) return null
  const slope = sxy / sxx
  let ssr = 0
  for (let i = 0; i < n; i++) ssr += ((ys[i] as number) - (my + slope * ((xs[i] as number) - mx))) ** 2
  return Math.sqrt(ssr / (n - 2) / sxx)
}

export type EstimateDay = Pick<StatsDay, 'date' | 'state' | 'kcal'>

export interface EstimateInput {
  today: LocalDate
  /** Tage des Zeitraums (estimateDates); andere werden ignoriert */
  days: readonly EstimateDay[]
  /** alle nicht gelöschten Wiegungen, auch ältere: sie wärmen den Trend vor */
  weights: readonly WeightSample[]
}

interface EstimateBasis {
  /** vollständige Tage im Zeitraum */
  completeDays: number
  /** Wiegetage im Zeitraum */
  weighings: number
}

export interface EstimateCollecting extends EstimateBasis {
  status: 'collecting'
  /** fehlende vollständige Tage bis zur ersten Schätzung */
  daysMissing: number
  /** Gewicht reicht noch nicht (zu wenige Wiegungen oder zu kurzer Trend) */
  weightsMissing: boolean
}

export interface EstimateReady extends EstimateBasis {
  status: 'ready'
  /** geschätzter Verbrauch kcal/Tag; atLeast, wenn die Zufuhr „mind.“ ist */
  kcal: NutrientSum & { value: number }
  /** ± kcal/Tag */
  spread: number
  /** Ø Zufuhr der vollständigen Tage */
  intake: NutrientSum & { value: number }
  trendFrom: { date: LocalDate; kg: number }
  trendTo: { date: LocalDate; kg: number }
  /** Trendänderung kg pro Woche (positiv = zugenommen) */
  kgPerWeek: number
}

export type Estimate = EstimateCollecting | EstimateReady

/**
 * Verbrauch = Ø Zufuhr der vollständigen Tage − Trendänderung pro Tag × 7.700.
 * Die Trendänderung läuft von der ersten bis zur letzten Wiegung im Zeitraum (davor zählt der Trend
 * aus älteren Wiegungen mit). Die Spanne kommt aus der Streuung der Wiegungen um ihre Ausgleichsgerade.
 */
export function estimate(input: EstimateInput): Estimate {
  const dates = estimateDates(input.today)
  const from = dates[0] as LocalDate
  const inWindow = input.days.filter((d) => d.date >= from && d.date <= input.today)
  const complete = inWindow.filter((d) => d.state === 'complete')

  const weighings = firstPerDay(input.weights).filter((w) => w.date >= from && w.date <= input.today)
  const firstW = weighings[0]
  const lastW = weighings[weighings.length - 1]
  const trendDays = firstW && lastW ? daysBetween(firstW.date, lastW.date) + 1 : 0
  const weightsMissing = weighings.length < MIN_WEIGHINGS || trendDays < MIN_TREND_DAYS

  const intake = averageSums(complete.map((d) => d.kcal))
  const basis = { completeDays: complete.length, weighings: weighings.length }
  const se = slopeStandardError(weighings)
  if (
    complete.length < MIN_COMPLETE_DAYS ||
    weightsMissing ||
    !firstW ||
    !lastW ||
    se === null ||
    intake === null ||
    intake.value === null
  ) {
    return {
      status: 'collecting',
      ...basis,
      daysMissing: Math.max(0, MIN_COMPLETE_DAYS - complete.length),
      weightsMissing,
    }
  }

  const points = dailyTrend(input.weights, input.today)
  const kgFrom = trendAt(points, firstW.date) as number
  const kgTo = trendAt(points, lastW.date) as number
  const perDay = (kgTo - kgFrom) / daysBetween(firstW.date, lastW.date)
  return {
    status: 'ready',
    ...basis,
    kcal: { value: intake.value - perDay * KCAL_PER_KG, atLeast: intake.atLeast },
    spread: SPREAD_Z * se * KCAL_PER_KG,
    intake: { value: intake.value, atLeast: intake.atLeast },
    trendFrom: { date: firstW.date, kg: kgFrom },
    trendTo: { date: lastW.date, kg: kgTo },
    kgPerWeek: perDay * 7,
  }
}

export interface BudgetComparison {
  /** Budget − Verbrauch kcal/Tag; positiv = Budget liegt über dem Verbrauch */
  diff: number
  /** rechnerische Gewichtsänderung pro Woche bei genau dem Budget */
  kgPerWeek: number
}

/** Abstand des festen Tagesziels zum geschätzten Verbrauch: 2.800 gegen 2.585 → +215 kcal, +0,2 kg/Woche */
export function compareToBudget(dailyBudget: number, burnedKcal: number): BudgetComparison {
  const diff = dailyBudget - burnedKcal
  return { diff, kgPerWeek: (diff * 7) / KCAL_PER_KG }
}
