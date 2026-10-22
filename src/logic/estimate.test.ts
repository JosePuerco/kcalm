import { describe, expect, it } from 'vitest'
import type { LocalDate } from '../db/types.ts'
import { addDays } from './dates.ts'
import {
  compareToBudget,
  dailyTrend,
  estimate,
  estimateDates,
  firstPerDay,
  slopeStandardError,
  trendAt,
  type EstimateDay,
  type WeightSample,
} from './estimate.ts'

// Do 22.10.2026; Schätzzeitraum 25.9. – 22.10.
const today = '2026-10-22'
const windowStart = '2026-09-25'

function w(date: LocalDate, kg: number, time = '07:00'): WeightSample {
  return { date, kg, measuredAt: new Date(`${date}T${time}:00`).toISOString() }
}

function day(date: LocalDate, kcal: number | null, state: EstimateDay['state'] = 'complete', atLeast = false): EstimateDay {
  return { date, state, kcal: { value: kcal, atLeast } }
}

/** Alle 28 Tage des Zeitraums mit gleicher Zufuhr */
function windowDays(kcal: number, state: EstimateDay['state'] = 'complete'): EstimateDay[] {
  return estimateDates(today).map((d) => day(d, kcal, state))
}

/** Tägliche Wiegungen von `from` bis heute, kg = f(Tag ab from) */
function dailyWeights(from: LocalDate, f: (i: number) => number, every = 1): WeightSample[] {
  const list: WeightSample[] = []
  for (let i = 0, d = from; d <= today; i++, d = addDays(d, 1)) if (i % every === 0) list.push(w(d, f(i)))
  return list
}

describe('firstPerDay', () => {
  it('nimmt pro Tag die früheste Messung, egal in welcher Reihenfolge sie kommt', () => {
    const list = firstPerDay([w('2026-10-20', 75.1, '21:30'), w('2026-10-20', 74.6, '06:50'), w('2026-10-20', 74.9, '12:00')])
    expect(list).toEqual([w('2026-10-20', 74.6, '06:50')])
  })

  it('sortiert nach Datum', () => {
    const list = firstPerDay([w('2026-10-21', 74), w('2026-10-19', 75), w('2026-10-20', 76)])
    expect(list.map((x) => x.date)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21'])
  })

  it('leere Liste bleibt leer', () => {
    expect(firstPerDay([])).toEqual([])
  })
})

describe('dailyTrend', () => {
  it('ohne Wiegung kein Trend', () => {
    expect(dailyTrend([], today)).toEqual([])
  })

  it('startet mit der ersten Wiegung und glättet mit 10 %', () => {
    const points = dailyTrend([w('2026-10-20', 74), w('2026-10-21', 75)], '2026-10-21')
    expect(points).toEqual([
      { date: '2026-10-20', trend: 74, kg: 74 },
      { date: '2026-10-21', trend: 74.1, kg: 75 },
    ])
  })

  it('ein Ausreißer von +1 kg hebt den Trend nur um 0,1 kg', () => {
    const points = dailyTrend([w('2026-10-19', 74), w('2026-10-20', 75), w('2026-10-21', 74)], '2026-10-21')
    expect(points.map((p) => p.trend)).toEqual([74, 74.1, expect.closeTo(74.09, 10)])
  })

  it('füllt Lücken linear auf: Wiegen alle 3 Tage ergibt denselben Trend wie täglich', () => {
    const f = (i: number) => 76 - i * 0.05
    const daily = dailyTrend(dailyWeights('2026-09-01', f), today)
    const sparse = dailyTrend(dailyWeights('2026-09-01', f, 3), today)
    // Der letzte Wiegetag bei „alle 3 Tage“ ist der 22.10. (51 Tage nach dem 1.9.)
    expect(sparse.at(-1)?.trend).toBeCloseTo(daily.at(-1)?.trend as number, 10)
    expect(sparse.filter((p) => p.kg !== null)).toHaveLength(18)
  })

  it('nach der letzten Wiegung bleibt der Trend stehen', () => {
    const points = dailyTrend([w('2026-10-19', 74), w('2026-10-20', 76)], today)
    expect(points.map((p) => p.trend)).toEqual([74, 74.2, 74.2, 74.2])
    expect(points.at(-1)?.kg).toBeNull()
  })

  it('mehrere Messungen am Tag: nur die erste geht ein', () => {
    const points = dailyTrend([w('2026-10-20', 74), w('2026-10-21', 80, '20:00'), w('2026-10-21', 75, '07:00')], '2026-10-21')
    expect(points.at(-1)).toEqual({ date: '2026-10-21', trend: 74.1, kg: 75 })
  })

  it('ignoriert Wiegungen nach dem Stichtag', () => {
    expect(dailyTrend([w('2026-10-23', 74)], today)).toEqual([])
  })
})

describe('trendAt', () => {
  const points = dailyTrend([w('2026-10-19', 74), w('2026-10-20', 76)], '2026-10-20')

  it('vor der ersten Wiegung unbekannt', () => {
    expect(trendAt(points, '2026-10-18')).toBeNull()
    expect(trendAt([], today)).toBeNull()
  })

  it('am Tag und danach der letzte bekannte Trend', () => {
    expect(trendAt(points, '2026-10-20')).toBeCloseTo(74.2, 10)
    expect(trendAt(points, '2026-11-30')).toBeCloseTo(74.2, 10)
  })
})

describe('estimateDates', () => {
  it('28 Tage bis einschließlich heute', () => {
    const dates = estimateDates(today)
    expect(dates).toHaveLength(28)
    expect(dates[0]).toBe(windowStart)
    expect(dates.at(-1)).toBe(today)
  })
})

describe('slopeStandardError', () => {
  it('Gewichte genau auf einer Geraden: keine Unsicherheit', () => {
    expect(slopeStandardError(dailyWeights(windowStart, (i) => 74 + i * 0.02))).toBeCloseTo(0, 10)
  })

  it('unter 3 Wiegungen oder alle am selben Tag: nicht berechenbar', () => {
    expect(slopeStandardError([w('2026-10-20', 74), w('2026-10-21', 75)])).toBeNull()
    expect(slopeStandardError([w(today, 74), w(today, 75), w(today, 76)])).toBeNull()
  })

  it('wird mit mehr Tagen kleiner', () => {
    const noise = (i: number) => 74 + (i % 2 === 0 ? 0.4 : -0.4)
    const short = slopeStandardError(dailyWeights(addDays(today, -13), noise)) as number
    const long = slopeStandardError(dailyWeights(windowStart, noise)) as number
    expect(long).toBeLessThan(short / 2)
  })
})

describe('estimate', () => {
  it('Beispiel aus dem Plan: Ø 2.750 kcal, Trend +0,6 kg in 28 Tagen → 2.585 kcal', () => {
    // Gleichmäßige Zunahme seit 90 Tagen, damit der Trend eingeschwungen ist
    const perDay = 0.6 / 28
    const result = estimate({
      today,
      days: windowDays(2750),
      weights: dailyWeights(addDays(today, -90), (i) => 73 + i * perDay),
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.kcal.value).toBeCloseTo(2585, 0)
    expect(result.kcal.atLeast).toBe(false)
    expect(result.intake.value).toBe(2750)
    expect(result.kgPerWeek).toBeCloseTo(0.15, 3)
    expect(result.trendFrom.date).toBe(windowStart)
    expect(result.trendTo.date).toBe(today)
    expect(result.completeDays).toBe(28)
    expect(result.weighings).toBe(28)
    // Gerade ohne Streuung
    expect(result.spread).toBeCloseTo(0, 6)
  })

  it('gleichbleibendes Gewicht: Verbrauch = Zufuhr', () => {
    const result = estimate({ today, days: windowDays(2400), weights: dailyWeights(windowStart, () => 74) })
    expect(result.status === 'ready' && result.kcal.value).toBeCloseTo(2400, 6)
  })

  it('Abnahme: Verbrauch liegt über der Zufuhr', () => {
    const result = estimate({ today, days: windowDays(2200), weights: dailyWeights(addDays(today, -90), (i) => 80 - i * 0.05) })
    // −0,05 kg/Tag × 7.700 = −385 kcal → 2.585
    expect(result.status === 'ready' && result.kcal.value).toBeCloseTo(2585, 0)
  })

  it('Spanne: typische Streuung ±0,4 kg, nach 28 Tagen um 150 kcal, nach 14 Tagen deutlich breiter', () => {
    const noise = (i: number) => 74 + [0.4, -0.3, 0.1, -0.4, 0.3, -0.1, 0][i % 7]!
    const long = estimate({ today, days: windowDays(2500), weights: dailyWeights(windowStart, noise) })
    const short = estimate({ today, days: windowDays(2500), weights: dailyWeights(addDays(today, -13), noise) })
    expect(long.status).toBe('ready')
    expect(short.status).toBe('ready')
    if (long.status !== 'ready' || short.status !== 'ready') return
    expect(long.spread).toBeGreaterThan(80)
    expect(long.spread).toBeLessThan(200)
    expect(short.spread).toBeGreaterThan(2.5 * long.spread)
  })

  describe('Sammelt Daten', () => {
    const weights = dailyWeights(windowStart, () => 74)

    it('ohne Daten', () => {
      expect(estimate({ today, days: [], weights: [] })).toEqual({
        status: 'collecting',
        completeDays: 0,
        weighings: 0,
        daysMissing: 14,
        weightsMissing: true,
        trendDays: 0,
      })
    })

    it('13 vollständige Tage reichen nicht, 14 schon', () => {
      const days = estimateDates(today).map((d, i) => day(d, 2500, i < 13 ? 'complete' : 'incomplete'))
      const r13 = estimate({ today, days, weights })
      expect(r13).toMatchObject({ status: 'collecting', completeDays: 13, daysMissing: 1, weightsMissing: false })
      const days14 = days.map((d, i) => (i === 13 ? { ...d, state: 'complete' as const } : d))
      expect(estimate({ today, days: days14, weights }).status).toBe('ready')
    })

    it('unvollständige, leere und künftige Tage zählen nicht', () => {
      const days = estimateDates(today).map((d, i) =>
        day(d, 9999, i % 3 === 0 ? 'incomplete' : i % 3 === 1 ? 'empty' : 'future'),
      )
      expect(estimate({ today, days, weights })).toMatchObject({ status: 'collecting', completeDays: 0, daysMissing: 14 })
    })

    it('unvollständige Tage gehen nicht in den Schnitt ein', () => {
      const days = estimateDates(today).map((d, i) => (i < 20 ? day(d, 2500) : day(d, 800, 'incomplete')))
      const result = estimate({ today, days, weights })
      expect(result.status === 'ready' && result.intake.value).toBe(2500)
      expect(result.completeDays).toBe(20)
    })

    it('Tage außerhalb des Zeitraums zählen nicht', () => {
      const old = Array.from({ length: 30 }, (_, i) => day(addDays(windowStart, -1 - i), 2500))
      expect(estimate({ today, days: old, weights })).toMatchObject({ status: 'collecting', completeDays: 0 })
    })

    it('zu wenige Wiegungen (6 statt 7)', () => {
      const few = dailyWeights(windowStart, () => 74, 5) // alle 5 Tage → 6 Wiegungen
      expect(few).toHaveLength(6)
      expect(estimate({ today, days: windowDays(2500), weights: few })).toMatchObject({
        status: 'collecting',
        weighings: 6,
        daysMissing: 0,
        weightsMissing: true,
      })
    })

    it('Wiegungen nur über 13 Tage: Trend zu kurz', () => {
      const recent = dailyWeights(addDays(today, -12), () => 74)
      expect(estimate({ today, days: windowDays(2500), weights: recent })).toMatchObject({
        status: 'collecting',
        weighings: 13,
        weightsMissing: true,
        trendDays: 13,
      })
    })

    it('Wiegungen nur vor dem Zeitraum zählen nicht', () => {
      const old = dailyWeights(addDays(windowStart, -40), () => 74).filter((x) => x.date < windowStart)
      expect(estimate({ today, days: windowDays(2500), weights: old })).toMatchObject({
        status: 'collecting',
        weighings: 0,
        weightsMissing: true,
      })
    })
  })

  it('Lücken beim Wiegen: alle 3 Tage ergibt dieselbe Schätzung wie täglich', () => {
    const f = (i: number) => 73 + i * 0.03
    const from = addDays(today, -87) // so liegt der 22.10. auf einem Wiegetag
    const daily = estimate({ today, days: windowDays(2600), weights: dailyWeights(from, f) })
    const sparse = estimate({ today, days: windowDays(2600), weights: dailyWeights(from, f, 3) })
    expect(daily.status).toBe('ready')
    expect(sparse.status).toBe('ready')
    if (daily.status !== 'ready' || sparse.status !== 'ready') return
    expect(sparse.kcal.value).toBeCloseTo(daily.kcal.value, 6)
    expect(sparse.weighings).toBe(10)
  })

  it('letzte Wiegung vor ein paar Tagen: Trend bis dahin, die Zufuhr bis heute', () => {
    const weights = dailyWeights(addDays(today, -90), (i) => 73 + i * 0.02).filter((x) => x.date <= '2026-10-18')
    const result = estimate({ today, days: windowDays(2500), weights })
    expect(result.status === 'ready' && result.trendTo.date).toBe('2026-10-18')
    // +0,02 kg/Tag × 7.700 = 154 kcal
    expect(result.status === 'ready' && result.kcal.value).toBeCloseTo(2500 - 154, 0)
  })

  it('mehrere Messungen pro Tag: die späteren (schwereren) verfälschen nichts', () => {
    const base = dailyWeights(windowStart, () => 74)
    const evening = base.map((x) => w(x.date, 75.5, '21:00'))
    const result = estimate({ today, days: windowDays(2500), weights: [...evening, ...base] })
    expect(result.status === 'ready' && result.kcal.value).toBeCloseTo(2500, 6)
    expect(result.weighings).toBe(28)
  })

  it('Zufuhr mit unbekannten kcal: Schätzung ist „mind.“', () => {
    const days = windowDays(2500).map((d, i) => (i === 0 ? { ...d, kcal: { value: 2000, atLeast: true } } : d))
    const result = estimate({ today, days, weights: dailyWeights(windowStart, () => 74) })
    expect(result.status === 'ready' && result.kcal.atLeast).toBe(true)
    expect(result.status === 'ready' && result.intake.atLeast).toBe(true)
  })
})

describe('compareToBudget', () => {
  it('Beispiel aus dem Prototyp: Budget 2.800, Verbrauch 2.585', () => {
    const c = compareToBudget(2800, 2585)
    expect(c.diff).toBe(215)
    expect(c.kgPerWeek).toBeCloseTo(0.195, 3)
  })

  it('Budget unter dem Verbrauch: negativ', () => {
    const c = compareToBudget(2200, 2585)
    expect(c.diff).toBe(-385)
    expect(c.kgPerWeek).toBeCloseTo(-0.35, 3)
  })
})
