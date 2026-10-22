import { describe, expect, it } from 'vitest'
import { newRecord, unknownNutrients } from '../db/records.ts'
import type { Entry, LocalDate, Nutrients, ProfileAssignment, ProfileVersion } from '../db/types.ts'
import {
  averageSums,
  barScale,
  buildStats,
  dayBars,
  macroAverages,
  nearestBar,
  statsDates,
  statsDays,
  statsTiles,
  weekBars,
  type StatsInput,
} from './stats.ts'

// Do 22.10.2026, Woche Mo 19.10. – So 25.10.
const today = '2026-10-22'

function version(id: string, weeklyKcal: number, extra: Partial<ProfileVersion> = {}): ProfileVersion {
  return {
    ...newRecord<ProfileVersion>({
      profileId: 'p',
      weeklyKcal,
      protein: { mode: 'g', value: 140 },
      fat: { mode: 'g', value: 80 },
      carbs: { mode: 'rest', value: null },
      fiberG: 30,
      manualWeightKg: null,
    }),
    id,
    ...extra,
  }
}

function assign(validFrom: LocalDate, versionId: string, weekBudgetOverride: number | null = null): ProfileAssignment {
  return newRecord<ProfileAssignment>({ validFrom, profileVersionId: versionId, weekBudgetOverride })
}

function entry(date: LocalDate, kcal: number | null, more: Partial<Nutrients> = {}): Entry {
  return newRecord<Entry>({
    date,
    slotId: 's',
    kind: 'quick',
    ref: null,
    nameSnapshot: 'Test',
    amount: null,
    unit: null,
    portionLabel: null,
    nutrients: { ...unknownNutrients(), kcal, ...more },
    mealGroupId: null,
    mealName: null,
  })
}

const v2800 = version('v1', 19600)
const base: Omit<StatsInput, 'dates' | 'entries' | 'completeDates'> = {
  today,
  assignments: [assign('2026-01-05', 'v1')],
  versions: [v2800],
}

function days(entries: Entry[], complete: LocalDate[], dates = statsDates(today, 'week'), extra: Partial<StatsInput> = {}) {
  return statsDays({ ...base, dates, entries, completeDates: new Set(complete), ...extra })
}

describe('statsDates', () => {
  it('Woche = laufende Woche Mo–So, auch mit künftigen Tagen', () => {
    const d = statsDates(today, 'week')
    expect(d).toHaveLength(7)
    expect(d[0]).toBe('2026-10-19')
    expect(d[6]).toBe('2026-10-25')
  })

  it('4 Wochen und 3 Monate enden mit der laufenden Woche', () => {
    const m = statsDates(today, 'month')
    expect(m).toHaveLength(28)
    expect(m[0]).toBe('2026-09-28')
    expect(m[27]).toBe('2026-10-25')
    const q = statsDates(today, 'quarter')
    expect(q).toHaveLength(91)
    expect(q[0]).toBe('2026-07-27')
  })

  it('an einem Montag bzw. Sonntag', () => {
    expect(statsDates('2026-10-19', 'week')[0]).toBe('2026-10-19')
    expect(statsDates('2026-10-25', 'week')[0]).toBe('2026-10-19')
  })

  it('über den Jahreswechsel', () => {
    const d = statsDates('2027-01-01', 'month')
    expect(d[0]).toBe('2026-12-07')
    expect(d[27]).toBe('2027-01-03')
  })

  it('Zeitumstellung (25.10.2026) verschluckt keinen Tag', () => {
    const d = statsDates('2026-10-26', 'week')
    expect(d).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
  })
})

describe('statsDays', () => {
  it('Status: vollständig, unvollständig, leer, künftig', () => {
    const d = days(
      [entry('2026-10-19', 2600), entry('2026-10-19', 300), entry('2026-10-20', 2500), entry('2026-10-24', 1200)],
      ['2026-10-19', '2026-10-21', '2026-10-24'],
    )
    expect(d.map((x) => x.state)).toEqual(['complete', 'incomplete', 'empty', 'empty', 'future', 'future', 'future'])
    expect(d[0]!.kcal).toEqual({ value: 2900, atLeast: false })
  })

  it('markierter Tag ohne Einträge zählt als leer', () => {
    expect(days([], ['2026-10-20'])[1]!.state).toBe('empty')
  })

  it('heute zählt, wenn markiert', () => {
    expect(days([entry(today, 2000)], [today])[3]!.state).toBe('complete')
    expect(days([entry(today, 2000)], [])[3]!.state).toBe('incomplete')
  })

  it('Ziel = festes Tagesziel der damals gültigen Version, Override „ab heute“ ändert es nicht', () => {
    const v2 = version('v2', 15400)
    const d = days([], [], undefined, {
      assignments: [assign('2026-01-05', 'v1'), assign('2026-10-22', 'v2', 17700)],
      versions: [v2800, v2],
    })
    expect(d[2]!.goal!.kcal).toBe(2800)
    expect(d[3]!.goal!.kcal).toBe(2200)
    expect(d[3]!.goal!.macros).toEqual({ protein: 140, fat: 80, carbs: (2200 - 140 * 4 - 80 * 9) / 4, fiber: 30 })
  })

  it('vor dem ersten Profil kein Ziel', () => {
    const d = days([], [], undefined, { assignments: [assign('2026-10-21', 'v1')] })
    expect(d[1]!.goal).toBeNull()
    expect(d[2]!.goal!.kcal).toBe(2800)
  })

  it('g/kg ohne Gewicht → Makroziel unbekannt', () => {
    const v = version('v1', 19600, { protein: { mode: 'gPerKg', value: 1.8 } })
    const d = days([], [], undefined, { versions: [v] })
    expect(d[0]!.goal!.macros.protein).toBeNull()
  })

  it('Einträge außerhalb des Zeitraums werden ignoriert', () => {
    const d = days([entry('2026-10-18', 9999)], [])
    expect(d.every((x) => x.state !== 'complete' && x.state !== 'incomplete')).toBe(true)
  })
})

describe('averageSums', () => {
  it('leer → null', () => {
    expect(averageSums([])).toBeNull()
  })

  it('exakt, ohne Zwischenrundung', () => {
    expect(averageSums([{ value: 2000, atLeast: false }, { value: 2001, atLeast: false }])).toEqual({
      value: 2000.5,
      atLeast: false,
    })
  })

  it('unbekannter oder unvollständiger Wert → „mind.“', () => {
    expect(averageSums([{ value: 2000, atLeast: true }, { value: 3000, atLeast: false }])).toEqual({
      value: 2500,
      atLeast: true,
    })
    expect(averageSums([{ value: null, atLeast: false }, { value: 3000, atLeast: false }])).toEqual({
      value: 1500,
      atLeast: true,
    })
  })

  it('alles unbekannt → unbekannt', () => {
    expect(averageSums([{ value: null, atLeast: false }])).toEqual({ value: null, atLeast: false })
  })
})

describe('statsTiles', () => {
  it('Ø, Vollständig und Bilanz nur über vollständige Tage', () => {
    const t = statsTiles(
      days(
        [entry('2026-10-19', 3000), entry('2026-10-20', 2700), entry('2026-10-21', 1000), entry(today, 500)],
        ['2026-10-19', '2026-10-20'],
      ),
    )
    expect(t.avgKcal).toEqual({ value: 2850, atLeast: false })
    expect(t.completeDays).toBe(2)
    expect(t.trackedDays).toBe(4)
    expect(t.balance).toEqual({ value: 50, atLeast: false })
  })

  it('keine vollständigen Tage → null statt 0', () => {
    const t = statsTiles(days([entry('2026-10-19', 3000)], []))
    expect(t.avgKcal).toBeNull()
    expect(t.balance).toBeNull()
    expect(t.completeDays).toBe(0)
    expect(t.trackedDays).toBe(1)
  })

  it('keine Daten', () => {
    expect(statsTiles(days([], []))).toEqual({ avgKcal: null, completeDays: 0, trackedDays: 0, balance: null })
  })

  it('Bilanz gegen das jeweilige Tagesziel bei Profilwechsel', () => {
    const v2 = version('v2', 15400)
    const t = statsTiles(
      days([entry('2026-10-21', 2800), entry(today, 2000)], ['2026-10-21', today], undefined, {
        assignments: [assign('2026-01-05', 'v1'), assign(today, 'v2', 17700)],
        versions: [v2800, v2],
      }),
    )
    // Mi 2.800 − 2.800 = 0, Do 2.000 − 2.200 = −200 → Ø −100
    expect(t.balance).toEqual({ value: -100, atLeast: false })
  })

  it('Tage vor dem ersten Profil zählen im Ø, nicht in der Bilanz', () => {
    const t = statsTiles(
      days([entry('2026-10-19', 2000), entry('2026-10-20', 3000)], ['2026-10-19', '2026-10-20'], undefined, {
        assignments: [assign('2026-10-20', 'v1')],
      }),
    )
    expect(t.avgKcal!.value).toBe(2500)
    expect(t.balance).toEqual({ value: 200, atLeast: false })
  })
})

describe('macroAverages', () => {
  it('Ø der vollständigen Tage gegen Ø der Ziele, Verhältnis ungekappt', () => {
    const m = macroAverages(
      days(
        [
          entry('2026-10-19', 2800, { protein: 120, carbs: 300, fat: 90, fiber: 20 }),
          entry('2026-10-20', 2800, { protein: 140, carbs: 340, fat: 82, fiber: 28 }),
          entry('2026-10-21', 2800, { protein: 10, carbs: 10, fat: 10, fiber: 1 }),
        ],
        ['2026-10-19', '2026-10-20'],
      ),
    )
    expect(m.map((x) => x.key)).toEqual(['protein', 'carbs', 'fat', 'fiber'])
    const [protein, , fat, fiber] = m
    expect(protein!.eaten).toEqual({ value: 130, atLeast: false })
    expect(protein!.goal).toBe(140)
    expect(protein!.ratio).toBeCloseTo(130 / 140)
    expect(fat!.ratio).toBeCloseTo(86 / 80)
    expect(fiber!.eaten!.value).toBe(24)
  })

  it('unbekannter Makrowert → „mind.“', () => {
    const m = macroAverages(
      days([entry('2026-10-19', 2800, { protein: 100 }), entry('2026-10-20', 2800)], ['2026-10-19', '2026-10-20']),
    )
    expect(m[0]!.eaten).toEqual({ value: 50, atLeast: true })
  })

  it('ohne Ballaststoffziel kein Ziel und kein Verhältnis', () => {
    const v = version('v1', 19600, { fiberG: null })
    const m = macroAverages(
      days([entry('2026-10-19', 2800, { fiber: 25 })], ['2026-10-19'], undefined, { versions: [v] }),
    )
    expect(m[3]!.goal).toBeNull()
    expect(m[3]!.ratio).toBeNull()
    expect(m[3]!.eaten!.value).toBe(25)
  })

  it('ohne vollständige Tage nichts', () => {
    const m = macroAverages(days([entry('2026-10-19', 2800)], []))
    expect(m.every((x) => x.eaten === null && x.ratio === null)).toBe(true)
  })

  it('Ziel 0 ergibt kein Verhältnis', () => {
    const v = version('v1', 19600, { fiberG: 0 })
    const m = macroAverages(days([entry('2026-10-19', 2800, { fiber: 5 })], ['2026-10-19'], undefined, { versions: [v] }))
    expect(m[3]!.ratio).toBeNull()
  })
})

describe('dayBars', () => {
  it('Woche: Wochentage, grau/blau, leere und künftige ohne Balken', () => {
    const b = dayBars(
      days([entry('2026-10-19', 2874), entry('2026-10-20', 1500)], ['2026-10-19']),
      today,
    )
    expect(b.map((x) => x.label)).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'])
    expect(b[0]).toMatchObject({ full: true, kcal: { value: 2874, atLeast: false }, caption: 'Mo 19.10.: 2.874 kcal' })
    expect(b[1]).toMatchObject({ full: false, caption: 'Di 20.10.: 1.500 kcal · unvollständig' })
    expect(b[2]).toMatchObject({ kcal: null, caption: 'Mi 21.10.: keine Einträge' })
    expect(b[5]).toMatchObject({ kcal: null, caption: 'Sa 24.10.: noch offen' })
  })

  it('4 Wochen: nur Montage beschriftet', () => {
    const b = dayBars(days([], [], statsDates(today, 'month')), today)
    expect(b.filter((x) => x.label !== '').map((x) => x.label)).toEqual(['28.9.', '5.10.', '12.10.', '19.10.'])
  })

  it('„mind.“ in der Beschriftung', () => {
    const b = dayBars(days([entry('2026-10-19', 2000), entry('2026-10-19', null)], []), today)
    expect(b[0]!.caption).toBe('Mo 19.10.: mind. 2.000 kcal · unvollständig')
  })
})

describe('weekBars', () => {
  // Vorwoche Mo 12.10. – So 18.10.
  const prevWeek = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']
  const twoWeeks = [...prevWeek, ...statsDates(today, 'week')]

  function bars(entries: Entry[], complete: LocalDate[], t = today) {
    return weekBars(days(entries, complete, twoWeeks, { today: t }), t)
  }

  it('5 von 7 vollständig → blau, Ø nur der vollständigen Tage', () => {
    const e = prevWeek.map((d, i) => entry(d, 2000 + i * 100))
    const b = bars(e, prevWeek.slice(0, 5))
    expect(b[0]).toMatchObject({ full: true, completeDays: 5, label: '', kcal: { value: 2200, atLeast: false } })
    expect(b[0]!.caption).toBe('KW 42: Ø 2.200 kcal · 5 von 7 Tagen vollständig')
  })

  it('4 von 7 → grau, trotzdem mit Ø', () => {
    const e = prevWeek.map((d) => entry(d, 2500))
    const b = bars(e, prevWeek.slice(0, 4))
    expect(b[0]).toMatchObject({ full: false, completeDays: 4, kcal: { value: 2500, atLeast: false } })
  })

  it('leere Tage zählen nicht als vollständig', () => {
    const b = bars(prevWeek.slice(0, 4).map((d) => entry(d, 2500)), prevWeek)
    expect(b[0]).toMatchObject({ full: false, completeDays: 4 })
  })

  it('keine vollständigen Tage → kein Balken', () => {
    const b = bars([entry('2026-10-12', 2500)], [])
    expect(b[0]).toMatchObject({ kcal: null, full: false, completeDays: 0, caption: 'KW 42: keine vollständigen Tage' })
  })

  it('laufende Woche blau, solange alle bisherigen Tage mit Einträgen vollständig sind', () => {
    const e = [entry('2026-10-19', 2800), entry('2026-10-21', 2700), entry(today, 900)]
    // Do noch nicht markiert, Di ohne Einträge: zählt nicht dagegen
    expect(bars(e, ['2026-10-19', '2026-10-21'])[1]!.full).toBe(true)
    // Mi unvollständig → grau
    expect(bars(e, ['2026-10-19'])[1]!.full).toBe(false)
  })

  it('laufende Woche ohne vollständige Tage → grau ohne Balken', () => {
    expect(bars([entry(today, 900)], [])[1]).toMatchObject({ full: false, kcal: null })
  })

  it('vergangene Woche: Sonderregel gilt nicht', () => {
    const b = bars([entry('2026-10-12', 2800)], ['2026-10-12'])
    expect(b[0]!.full).toBe(false)
  })

  it('KW über den Jahreswechsel', () => {
    const d = statsDates('2027-01-06', 'quarter')
    const b = weekBars(statsDays({ ...base, today: '2027-01-06', dates: d, entries: [], completeDates: new Set() }), '2027-01-06')
    expect(b.slice(-3).map((x) => x.caption.split(':')[0])).toEqual(['KW 52', 'KW 53', 'KW 1'])
  })

  it('3 Monate: jede zweite Woche beschriftet, die laufende immer', () => {
    const b = weekBars(days([], [], statsDates(today, 'quarter')), today)
    expect(b.map((x) => x.label)).toEqual([
      'KW31', '', 'KW33', '', 'KW35', '', 'KW37', '', 'KW39', '', 'KW41', '', 'KW43',
    ])
  })
})

describe('barScale', () => {
  const bar = (value: number | null) => ({ date: today, label: '', kcal: value === null ? null : { value, atLeast: false }, full: true, completeDays: null, caption: '' })

  it('Ziel bei 7/8 der Höhe', () => {
    expect(barScale([bar(2000), bar(null)], 2800)).toBe(3200)
  })

  it('höhere Balken strecken den Maßstab', () => {
    expect(barScale([bar(4100)], 2800)).toBe(4100)
  })

  it('ohne Ziel und ohne Daten nie 0', () => {
    expect(barScale([], null)).toBe(1)
    expect(barScale([bar(1500)], null)).toBe(1500)
  })
})

describe('nearestBar', () => {
  it('Balken unter dem Finger', () => {
    expect(nearestBar(0, 280, 28)).toBe(0)
    expect(nearestBar(9.9, 280, 28)).toBe(0)
    expect(nearestBar(10, 280, 28)).toBe(1)
    expect(nearestBar(279, 280, 28)).toBe(27)
  })

  it('außerhalb wird auf den Rand begrenzt (Wischen über den Rand)', () => {
    expect(nearestBar(-20, 280, 7)).toBe(0)
    expect(nearestBar(400, 280, 7)).toBe(6)
  })

  it('keine Balken oder keine Breite', () => {
    expect(nearestBar(10, 280, 0)).toBe(-1)
    expect(nearestBar(10, 0, 7)).toBe(-1)
  })
})

describe('buildStats', () => {
  it('setzt alles für den Zeitraum zusammen', () => {
    const s = buildStats('quarter', { ...base, entries: [entry('2026-10-19', 2800)], completeDates: new Set(['2026-10-19']) })
    expect(s.bars).toHaveLength(13)
    expect(s.goalLine).toBe(2800)
    expect(s.scale).toBe(3200)
    expect(s.tiles.completeDays).toBe(1)
    expect(buildStats('month', { ...base, entries: [], completeDates: new Set() }).bars).toHaveLength(28)
  })

  it('ohne Profil keine Ziellinie', () => {
    const s = buildStats('week', { ...base, assignments: [], entries: [], completeDates: new Set() })
    expect(s.goalLine).toBeNull()
    expect(s.macros.every((m) => m.goal === null)).toBe(true)
  })
})
