import { describe, expect, it } from 'vitest'
import type { LocalDate } from '../db/types.ts'
import { addDays } from './dates.ts'
import { estimateDates, type EstimateCollecting, type EstimateDay, type EstimateReady } from './estimate.ts'
import {
  budgetView,
  collectingView,
  estimateLinkText,
  importMessage,
  lastWeightText,
  manualWeightError,
  resultView,
} from './estimateView.ts'

const today = '2026-10-22'

function ready(kcal: number, spread: number, extra: Partial<EstimateReady> = {}): EstimateReady {
  return {
    status: 'ready',
    completeDays: 25,
    weighings: 24,
    kcal: { value: kcal, atLeast: false },
    spread,
    intake: { value: 2750, atLeast: false },
    trendFrom: { date: '2026-09-25', kg: 74.2 },
    trendTo: { date: today, kg: 74.66 },
    kgPerWeek: 0.12,
    ...extra,
  }
}

function collecting(extra: Partial<EstimateCollecting> = {}): EstimateCollecting {
  return { status: 'collecting', completeDays: 0, weighings: 0, daysMissing: 14, weightsMissing: true, trendDays: 0, ...extra }
}

describe('resultView', () => {
  it('Beispiel aus dem Prototyp: 2.585 ± 150, Budget 2.800', () => {
    const v = resultView(ready(2584.6, 147), 2800)
    expect(v.kcal).toBe('2.585')
    expect(v.spread).toBe('± 150 kcal/Tag')
    expect(v.caption).toBe('Spanne 2.435–2.735 · Budget 2.800 gestrichelt')
    expect(v.bar.min).toBe(2000)
    expect(v.bar.max).toBe(3200)
    expect(v.bar.marker).toBeCloseTo((585 / 1200) * 100, 6)
    expect(v.bar.rangeLeft).toBeCloseTo((435 / 1200) * 100, 6)
    expect(v.bar.rangeWidth).toBeCloseTo(25, 6)
    expect(v.bar.budget).toBeCloseTo((800 / 1200) * 100, 6)
    expect(v.basis).toEqual([
      { label: 'Zeitraum', value: '28 Tage' },
      { label: 'Vollständige Tage', value: '25 von 28' },
      { label: 'Wiegungen', value: '24' },
      { label: 'Trend', value: '74,2 → 74,7 kg' },
    ])
  })

  it('ohne Profil: kein Budget-Strich', () => {
    const v = resultView(ready(2585, 150), null)
    expect(v.bar.budget).toBeNull()
    expect(v.caption).toBe('Spanne 2.435–2.735')
    expect(v.bar.min).toBe(2000)
    expect(v.bar.max).toBe(3200)
  })

  it('Budget weit unter der Spanne: Leiste reicht bis zum Budget', () => {
    const v = resultView(ready(2585, 150), 1800)
    expect(v.bar.min).toBe(1400)
    expect(v.bar.budget).toBeGreaterThan(0)
  })

  it('unbekannte kcal in der Zufuhr: „mind.“', () => {
    expect(resultView(ready(2585, 150, { kcal: { value: 2585, atLeast: true } }), 2800).kcal).toBe('mind. 2.585')
  })

  it('Spanne 0: Leiste ohne Breite', () => {
    expect(resultView(ready(2500, 3), 2800).bar.rangeWidth).toBe(0)
  })
})

describe('budgetView', () => {
  it('Budget über dem Verbrauch', () => {
    expect(budgetView(ready(2585, 150), 2800)).toEqual({ diff: '215 kcal/Tag', direction: 'over', kgPerWeek: '+0,2 kg pro Woche' })
  })

  it('Budget unter dem Verbrauch', () => {
    expect(budgetView(ready(2585, 150), 2200)).toEqual({ diff: '385 kcal/Tag', direction: 'under', kgPerWeek: '-0,4 kg pro Woche' })
  })

  it('gleich, auch wenn die Schätzung Nachkommastellen hat', () => {
    expect(budgetView(ready(2799.6, 150), 2800)).toMatchObject({ direction: 'equal', kgPerWeek: '0,0 kg pro Woche' })
  })

  it('kleiner Abstand: kein „+“ vor 0,0', () => {
    expect(budgetView(ready(2780, 150), 2800).kgPerWeek).toBe('0,0 kg pro Woche')
  })
})

describe('collectingView', () => {
  const window = estimateDates(today)
  const days = (states: Partial<Record<LocalDate, EstimateDay['state']>>): EstimateDay[] =>
    window.map((date) => ({ date, state: states[date] ?? 'empty', kcal: { value: 2000, atLeast: false } }))

  it('noch nichts getrackt: 14 helle Felder', () => {
    const v = collectingView(collecting(), days({}), today)
    expect(v).toMatchObject({ label: 'Erste Schätzung in', value: 14, unit: 'vollständigen Tagen' })
    expect(v.cells).toEqual(Array(14).fill('open'))
  })

  it('ab dem ersten Tag mit Einträgen; heute unmarkiert zählt noch nicht als grau', () => {
    const d = (n: number) => addDays(today, -n)
    const v = collectingView(
      collecting({ completeDays: 3, daysMissing: 11 }),
      days({ [d(5)]: 'complete', [d(4)]: 'incomplete', [d(2)]: 'complete', [d(1)]: 'complete', [today]: 'incomplete' }),
      today,
    )
    // d5 blau, d4 grau, d3 leer = grau, d2, d1 blau; heute fehlt; dann 11 offen
    expect(v.cells).toEqual(['counted', 'skipped', 'skipped', 'counted', 'counted', ...Array(11).fill('open')])
  })

  it('heute markiert: blau', () => {
    const v = collectingView(collecting({ completeDays: 1, daysMissing: 13 }), days({ [today]: 'complete' }), today)
    expect(v.cells).toEqual(['counted', ...Array(13).fill('open')])
  })

  it('ein Tag fehlt: Einzahl', () => {
    expect(collectingView(collecting({ daysMissing: 1 }), days({}), today).unit).toBe('vollständigem Tag')
  })

  it('Hinweis aufs Gewicht, solange auch Tage fehlen', () => {
    expect(collectingView(collecting({ weighings: 3 }), days({}), today).weightHint).toBe(
      'Außerdem nötig: mindestens 7 Wiegungen, verteilt über 14 Tage (bisher 3).',
    )
    expect(collectingView(collecting({ weightsMissing: false }), days({}), today).weightHint).toBeNull()
  })

  it('Tage reichen, Wiegungen fehlen', () => {
    const v = collectingView(collecting({ daysMissing: 0, completeDays: 14, weighings: 5 }), days({}), today)
    expect(v).toMatchObject({ label: 'Erste Schätzung nach', value: 2, unit: 'weiteren Wiegungen', weightHint: null })
    expect(collectingView(collecting({ daysMissing: 0, weighings: 6 }), days({}), today).unit).toBe('weiteren Wiegung')
  })

  it('genug Wiegungen, aber der Trend ist zu kurz', () => {
    const v = collectingView(collecting({ daysMissing: 0, weighings: 10, trendDays: 10 }), days({}), today)
    expect(v).toMatchObject({ label: 'Erste Schätzung in', value: 4, unit: 'Tagen mit Wiegungen' })
    expect(collectingView(collecting({ daysMissing: 0, weighings: 10, trendDays: 13 }), days({}), today).unit).toBe('Tag mit Wiegung')
  })
})

describe('lastWeightText', () => {
  it('noch keins', () => {
    expect(lastWeightText(undefined, today)).toBe('Noch keins')
  })

  it('aus Health mit Uhrzeit, manuell ohne', () => {
    const measuredAt = new Date(2026, 9, 22, 7, 12).toISOString()
    expect(lastWeightText({ date: today, kg: 74.8, measuredAt, source: 'health' }, today)).toBe('Heute 07:12 · 74,8 kg')
    expect(lastWeightText({ date: '2026-10-21', kg: 75, measuredAt, source: 'manual' }, today)).toBe('Gestern · 75,0 kg')
    expect(lastWeightText({ date: '2026-10-19', kg: 75, measuredAt, source: 'manual' }, today)).toBe('Mo 19.10. · 75,0 kg')
  })
})

describe('importMessage', () => {
  it('wie im Prototyp', () => {
    expect(importMessage({ read: 60, created: 1, updated: 0, duplicates: 0 })).toBe('60 Werte gelesen · 1 neu · 0 doppelt')
  })

  it('aktualisierte Tage zählen als neu; Einzahl', () => {
    expect(importMessage({ read: 1, created: 0, updated: 1, duplicates: 0 })).toBe('1 Wert gelesen · 1 neu · 0 doppelt')
  })
})

describe('manualWeightError', () => {
  it.each([
    ['', 'Gewicht eingeben'],
    ['7,4', 'Zwischen 20 und 300 kg'],
    ['301', 'Zwischen 20 und 300 kg'],
    ['74,8', null],
    ['74,', null],
  ])('„%s“ → %s', (value, error) => {
    expect(manualWeightError(value)).toBe(error)
  })
})

describe('estimateLinkText', () => {
  it('Ergebnis wie im Prototyp, sonst „Sammelt Daten“', () => {
    expect(estimateLinkText(ready(2584.6, 147))).toBe('Verbrauch 2.585 ± 150 kcal')
    expect(estimateLinkText(ready(2585, 150, { kcal: { value: 2585, atLeast: true } }))).toBe('Verbrauch mind. 2.585 ± 150 kcal')
    expect(estimateLinkText(collecting())).toBe('Sammelt Daten')
  })
})
