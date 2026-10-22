// Anzeige-Werte für den Schätz-Screen (Schaetzung.dc.html): Texte, Leiste, Raster. Reine Funktionen.

import type { LocalDate, Weight } from '../db/types.ts'
import { dayLabel } from './diary.ts'
import {
  compareToBudget,
  ESTIMATE_WINDOW_DAYS,
  MIN_TREND_DAYS,
  MIN_WEIGHINGS,
  type EstimateCollecting,
  type EstimateDay,
  type EstimateReady,
} from './estimate.ts'
import { formatNumber, formatTime } from './format.ts'
import { parseKeypadValue } from './keypad.ts'
import { MAX_KG, MIN_KG } from './weightImport.ts'

/** Die Spanne wird auf 10 kcal gerundet angezeigt; genauer ist sie nicht */
const SPREAD_STEP = 10
/** Leiste: so viel Luft links und rechts von Spanne und Budget, Enden auf volle 100 */
const BAR_PAD = 400
const BAR_STEP = 100

export interface EstimateBar {
  /** kcal am linken und rechten Rand */
  min: number
  max: number
  /** Positionen in Prozent der Breite */
  marker: number
  rangeLeft: number
  rangeWidth: number
  /** null = kein Profil */
  budget: number | null
}

export interface ResultView {
  /** „2.585“ bzw. „mind. 2.585“ */
  kcal: string
  /** „± 150 kcal/Tag“ */
  spread: string
  bar: EstimateBar
  /** „Spanne 2.435–2.735 · Budget 2.800 gestrichelt“ */
  caption: string
  basis: { label: string; value: string }[]
}

export function resultView(e: EstimateReady, budget: number | null): ResultView {
  const kcal = Math.round(e.kcal.value)
  const spread = Math.round(e.spread / SPREAD_STEP) * SPREAD_STEP
  const low = kcal - spread
  const high = kcal + spread
  const lo = Math.min(low, budget ?? low)
  const hi = Math.max(high, budget ?? high)
  const min = Math.floor((lo - BAR_PAD) / BAR_STEP) * BAR_STEP
  const max = Math.ceil((hi + BAR_PAD) / BAR_STEP) * BAR_STEP
  const pct = (v: number) => ((v - min) / (max - min)) * 100
  return {
    kcal: `${e.kcal.atLeast ? 'mind. ' : ''}${formatNumber(kcal)}`,
    spread: `± ${formatNumber(spread)} kcal/Tag`,
    bar: {
      min,
      max,
      marker: pct(kcal),
      rangeLeft: pct(low),
      rangeWidth: pct(high) - pct(low),
      budget: budget === null ? null : pct(budget),
    },
    caption: `Spanne ${formatNumber(low)}–${formatNumber(high)}${budget === null ? '' : ` · Budget ${formatNumber(budget)} gestrichelt`}`,
    basis: [
      { label: 'Zeitraum', value: `${ESTIMATE_WINDOW_DAYS} Tage` },
      { label: 'Vollständige Tage', value: `${e.completeDays} von ${ESTIMATE_WINDOW_DAYS}` },
      { label: 'Wiegungen', value: formatNumber(e.weighings) },
      { label: 'Trend', value: `${formatNumber(e.trendFrom.kg, 1)} → ${formatNumber(e.trendTo.kg, 1)} kg` },
    ],
  }
}

export interface BudgetView {
  /** „215 kcal/Tag“ (Betrag) */
  diff: string
  /** Budget liegt über / unter dem Verbrauch oder gleich (unter 1 kcal) */
  direction: 'over' | 'under' | 'equal'
  /** „+0,2 kg pro Woche“ */
  kgPerWeek: string
}

export function budgetView(e: EstimateReady, budget: number): BudgetView {
  const c = compareToBudget(budget, Math.round(e.kcal.value))
  const diff = Math.round(c.diff)
  const kg = formatNumber(c.kgPerWeek, 1)
  return {
    diff: `${formatNumber(Math.abs(diff))} kcal/Tag`,
    direction: diff > 0 ? 'over' : diff < 0 ? 'under' : 'equal',
    kgPerWeek: `${diff > 0 && kg !== '0,0' ? '+' : ''}${kg} kg pro Woche`,
  }
}

/** counted = vollständig (blau), skipped = zählt nicht (grau), open = fehlt noch (hell) */
export type CollectCell = 'counted' | 'skipped' | 'open'

export interface CollectingView {
  /** „Erste Schätzung in“ */
  label: string
  value: number
  /** „vollständigen Tagen“ */
  unit: string
  cells: CollectCell[]
  /** fehlt neben den Tagen noch Gewicht: Hinweis unter dem Raster */
  weightHint: string | null
}

/**
 * Raster: Tage ab dem ersten Tag mit Einträgen im Zeitraum (vollständig = blau, sonst grau), danach je ein helles
 * Feld für jeden noch fehlenden vollständigen Tag. Heute steht nur als blau drin; unmarkiert ist er noch offen.
 */
export function collectingView(e: EstimateCollecting, days: readonly EstimateDay[], today: LocalDate): CollectingView {
  const sorted = [...days].filter((d) => d.date <= today).sort((a, b) => (a.date < b.date ? -1 : 1))
  const start = sorted.findIndex((d) => d.state === 'complete' || d.state === 'incomplete')
  const past: CollectCell[] =
    start === -1
      ? []
      : sorted
          .slice(start)
          .filter((d) => d.date < today || d.state === 'complete')
          .map((d) => (d.state === 'complete' ? 'counted' : 'skipped'))
  const cells = [...past, ...Array.from({ length: e.daysMissing }, (): CollectCell => 'open')]

  const missingWeighings = Math.max(0, MIN_WEIGHINGS - e.weighings)
  let head: Pick<CollectingView, 'label' | 'value' | 'unit'>
  if (e.daysMissing > 0) {
    head = { label: 'Erste Schätzung in', value: e.daysMissing, unit: e.daysMissing === 1 ? 'vollständigem Tag' : 'vollständigen Tagen' }
  } else if (missingWeighings > 0) {
    head = { label: 'Erste Schätzung nach', value: missingWeighings, unit: missingWeighings === 1 ? 'weiteren Wiegung' : 'weiteren Wiegungen' }
  } else {
    const n = Math.max(1, MIN_TREND_DAYS - e.trendDays)
    head = { label: 'Erste Schätzung in', value: n, unit: n === 1 ? 'Tag mit Wiegung' : 'Tagen mit Wiegungen' }
  }
  return {
    ...head,
    cells,
    weightHint:
      e.daysMissing > 0 && e.weightsMissing
        ? `Außerdem nötig: mindestens ${MIN_WEIGHINGS} Wiegungen, verteilt über ${MIN_TREND_DAYS} Tage (bisher ${e.weighings}).`
        : null,
  }
}

/** „Heute 07:12 · 74,8 kg“; manuell ohne Uhrzeit: „Gestern · 74,8 kg“ */
export function lastWeightText(weight: Pick<Weight, 'date' | 'kg' | 'measuredAt' | 'source'> | undefined, today: LocalDate): string {
  if (!weight) return 'Noch keins'
  const label = dayLabel(weight.date, today)
  const day = label.relative ?? label.date
  const time = weight.source === 'health' ? ` ${formatTime(new Date(weight.measuredAt))}` : ''
  return `${day}${time} · ${formatNumber(weight.kg, 1)} kg`
}

/** Toast nach dem Import: „60 Werte gelesen · 1 neu · 0 doppelt“ */
export function importMessage(r: { read: number; created: number; updated: number; duplicates: number }): string {
  return `${formatNumber(r.read)} ${r.read === 1 ? 'Wert' : 'Werte'} gelesen · ${formatNumber(r.created + r.updated)} neu · ${formatNumber(r.duplicates)} doppelt`
}

/** Eingabe im Ziffernblock prüfen; null = in Ordnung */
export function manualWeightError(value: string): string | null {
  const kg = parseKeypadValue(value)
  if (kg === null) return 'Gewicht eingeben'
  if (kg < MIN_KG || kg > MAX_KG) return `Zwischen ${MIN_KG} und ${MAX_KG} kg`
  return null
}
