import { describe, expect, it } from 'vitest'
import type { LocalDate } from '../db/types.ts'
import { addDays } from './dates.ts'
import type { WeightSample } from './estimate.ts'
import { statsDates } from './stats.ts'
import { weightChart } from './weightChart.ts'

// Do 22.10.2026, Woche Mo 19.10. – So 25.10.
const today = '2026-10-22'
const w = (date: LocalDate, kg: number, time = '07:00'): WeightSample => ({
  date,
  kg,
  measuredAt: new Date(`${date}T${time}:00`).toISOString(),
})

describe('weightChart', () => {
  const week = statsDates(today, 'week')

  it('ohne Wiegungen: keine Karte', () => {
    expect(weightChart(week, today, [], 'week')).toBeNull()
  })

  it('Wiegung nur nach heute zählt nicht', () => {
    expect(weightChart(week, today, [w('2026-10-24', 74)], 'week')).toBeNull()
  })

  it('Woche: Punkte in der Mitte der Tagesspalte, Trend bis zur letzten Wiegung', () => {
    const c = weightChart(week, today, [w('2026-10-19', 74), w('2026-10-21', 75)], 'week')!
    expect(c.measured).toEqual([
      { x: 0.5 / 7, kg: 74 },
      { x: 2.5 / 7, kg: 75 },
    ])
    // 19.: 74; 20.: halb aufgefüllt 74,5 → 74,05; 21.: 75 → 74,145; der 22. ohne Wiegung fehlt
    expect(c.trend.map((p) => p.x)).toEqual([0.5 / 7, 1.5 / 7, 2.5 / 7])
    expect(c.trend.at(-1)?.kg).toBeCloseTo(74.145, 10)
    expect(c.changeText).toBe('+0,1 kg in 2 Tagen')
    expect(c.label).toBe('Gewichtstrend von 74,0 auf 74,1 Kilogramm, 2 Wiegungen')
  })

  it('ganzer Zeitraum mit Trend: Text nach Zeitraum', () => {
    const weights = Array.from({ length: 30 }, (_, i) => w(addDays(today, -i), 75 - i * 0.02))
    expect(weightChart(week, today, weights, 'week')?.changeText).toMatch(/kg diese Woche$/)
    const month = weightChart(statsDates(today, 'month'), today, weights, 'month')
    expect(month?.changeText).toMatch(/^\+0,\d kg in 4 Wochen$/)
  })

  it('Abnahme: ohne Plus, mit Minus', () => {
    const weights = Array.from({ length: 60 }, (_, i) => w(addDays(today, -i), 74 + i * 0.03))
    expect(weightChart(statsDates(today, 'month'), today, weights, 'month')?.changeText).toMatch(/^-0,\d kg in 4 Wochen$/)
  })

  it('ältere Wiegungen wärmen den Trend vor, erscheinen aber nicht als Punkte', () => {
    const c = weightChart(week, today, [w('2026-10-01', 80), w('2026-10-20', 74)], 'week')!
    expect(c.measured).toEqual([{ x: 1.5 / 7, kg: 74 }])
    // Der Trend am Montag kommt aus dem Oktober-Verlauf und liegt noch deutlich über 74
    expect(c.trend[0]?.kg).toBeGreaterThan(76)
    expect(c.changeText).toMatch(/^-0,\d kg in 1 Tag$/)
  })

  it('Achse: auf halbe kg gerundet, mindestens 1 kg', () => {
    // 74,2–74,3 → 74,0–74,5, auf 1 kg erweitert
    const flat = weightChart(week, today, [w('2026-10-19', 74.2), w('2026-10-20', 74.3)], 'week')!
    expect([flat.min, flat.max]).toEqual([74, 75])
    const wide = weightChart(week, today, [w('2026-10-19', 73.2), w('2026-10-21', 75.4)], 'week')!
    expect([wide.min, wide.max]).toEqual([73, 75.5])
  })

  it('mehrere Messungen am Tag: nur die erste ist ein Punkt', () => {
    const c = weightChart(week, today, [w('2026-10-20', 76, '21:00'), w('2026-10-20', 74, '07:00')], 'week')!
    expect(c.measured).toEqual([{ x: 1.5 / 7, kg: 74 }])
    expect(c.changeText).toBeNull()
  })
})
