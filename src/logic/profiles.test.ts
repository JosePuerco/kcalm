import { describe, expect, it } from 'vitest'
import { dynamicTargetFor, weekStatus } from './goals.ts'
import {
  assignmentFor,
  goalFor,
  latestVersion,
  profileStatus,
  switchFromNextMonday,
  switchFromToday,
  targetsChanged,
} from './profiles.ts'

const assignment = (
  validFrom: string,
  profileVersionId: string,
  weekBudgetOverride: number | null = null,
  createdAt = `${validFrom}T08:00:00.000Z`,
  deletedAt: string | null = null,
) => ({ validFrom, profileVersionId, weekBudgetOverride, createdAt, deletedAt })

const versions = [
  { id: 'aufbau', weeklyKcal: 19600 },
  { id: 'diaet', weeklyKcal: 15400 },
]

describe('switchFromNextMonday', () => {
  it('Standard: ab dem Montag nach heute, ohne Override', () => {
    expect(switchFromNextMonday('2026-10-21')).toEqual({ validFrom: '2026-10-26', weekBudgetOverride: null })
  })

  it('an einem Montag: der Montag in einer Woche', () => {
    expect(switchFromNextMonday('2026-10-19').validFrom).toBe('2026-10-26')
  })

  it('am Sonntag: morgen', () => {
    expect(switchFromNextMonday('2026-10-25').validFrom).toBe('2026-10-26')
  })
})

describe('switchFromToday', () => {
  it('PLAN.md: Wechsel Do auf 15.400, Mo–Mi 8.900 → 15.400 × 4 ÷ 7 + 8.900 = 17.700', () => {
    expect(switchFromToday('2026-10-22', 15400, 8900)).toEqual({ validFrom: '2026-10-22', weekBudgetOverride: 17700 })
  })

  it('am Sonntag: ein Siebtel plus Verbrauch', () => {
    expect(switchFromToday('2026-10-25', 15400, 17000).weekBudgetOverride).toBe(19200)
  })

  it('am Montag: kein Override nötig', () => {
    expect(switchFromToday('2026-10-19', 15400, 0)).toEqual({ validFrom: '2026-10-19', weekBudgetOverride: null })
  })

  it('rundet intern nicht', () => {
    expect(switchFromToday('2026-10-20', 15000, 2500).weekBudgetOverride).toBeCloseTo((15000 * 6) / 7 + 2500, 10)
  })
})

describe('assignmentFor', () => {
  const list = [assignment('2026-09-01', 'aufbau'), assignment('2026-10-26', 'diaet')]

  it('vor dem ersten Profil: keins', () => {
    expect(assignmentFor(list, '2026-08-31')).toBeNull()
    expect(assignmentFor([], '2026-10-21')).toBeNull()
  })

  it('gilt ab validFrom, bis zur nächsten Zuweisung', () => {
    expect(assignmentFor(list, '2026-09-01')?.profileVersionId).toBe('aufbau')
    expect(assignmentFor(list, '2026-10-25')?.profileVersionId).toBe('aufbau')
    expect(assignmentFor(list, '2026-10-26')?.profileVersionId).toBe('diaet')
    expect(assignmentFor(list, '2027-01-01')?.profileVersionId).toBe('diaet')
  })

  it('Reihenfolge der Liste egal', () => {
    expect(assignmentFor([...list].reverse(), '2026-10-30')?.profileVersionId).toBe('diaet')
  })

  it('gleiches Startdatum: zuletzt angelegte gewinnt', () => {
    const twice = [
      assignment('2026-10-26', 'diaet', null, '2026-10-21T08:00:00.000Z'),
      assignment('2026-10-26', 'aufbau', null, '2026-10-21T09:00:00.000Z'),
    ]
    expect(assignmentFor(twice, '2026-10-26')?.profileVersionId).toBe('aufbau')
  })

  it('gelöschte Zuweisungen zählen nicht', () => {
    const withDeleted = [...list, assignment('2026-10-01', 'diaet', null, undefined, '2026-10-02T00:00:00.000Z')]
    expect(assignmentFor(withDeleted, '2026-10-10')?.profileVersionId).toBe('aufbau')
  })
})

describe('goalFor', () => {
  it('ohne Profil: null', () => {
    expect(goalFor([], versions, '2026-10-21')).toBeNull()
  })

  it('Version fehlt: null', () => {
    expect(goalFor([assignment('2026-09-01', 'weg')], versions, '2026-10-21')).toBeNull()
  })

  it('„ab nächstem Montag“: laufende Woche alt, nächste Woche neu', () => {
    const list = [assignment('2026-09-01', 'aufbau'), { ...assignment('2026-10-26', 'diaet'), ...switchFromNextMonday('2026-10-22') }]
    expect(goalFor(list, versions, '2026-10-25')?.weekBudget).toBe(19600)
    expect(goalFor(list, versions, '2026-10-26')?.weekBudget).toBe(15400)
  })

  it('„ab heute“: Vortage behalten ihr Profil, ab heute gilt der Override, nächste Woche das neue Budget', () => {
    const list = [assignment('2026-09-01', 'aufbau'), assignment('2026-10-22', 'diaet', 17700)]
    expect(goalFor(list, versions, '2026-10-21')).toMatchObject({ weekBudget: 19600, version: { id: 'aufbau' } })
    expect(goalFor(list, versions, '2026-10-22')).toMatchObject({ weekBudget: 17700, version: { id: 'diaet' } })
    expect(goalFor(list, versions, '2026-10-25')?.weekBudget).toBe(17700)
    expect(goalFor(list, versions, '2026-10-26')?.weekBudget).toBe(15400)
  })

  it('countFrom: erster Profiltag nur in seiner Woche', () => {
    const list = [assignment('2026-10-21', 'aufbau', 14000), assignment('2026-10-23', 'diaet', 12000)]
    expect(goalFor(list, versions, '2026-10-21')?.countFrom).toBe('2026-10-21')
    expect(goalFor(list, versions, '2026-10-24')?.countFrom).toBe('2026-10-21')
    expect(goalFor(list, versions, '2026-10-26')?.countFrom).toBeNull()
  })

  it('Ende zu Ende: nach dem Wechsel Do ergibt das dynamische Ziel das neue Restbudget ÷ 4', () => {
    const today = '2026-10-22'
    const kcal = { '2026-10-19': 2950, '2026-10-20': 3100, '2026-10-21': 2850 }
    const sw = switchFromToday(today, 15400, 8900)
    const list = [assignment('2026-09-01', 'aufbau'), { ...assignment(today, 'diaet'), ...sw }]
    const goal = goalFor(list, versions, today)!
    // (17.700 − 8.900) ÷ 4 = 2.200 = 15.400 ÷ 7
    expect(dynamicTargetFor(today, today, kcal, goal.weekBudget)).toBeCloseTo(2200, 10)
    expect(weekStatus(today, today, kcal, goal.weekBudget).remaining).toBeCloseTo(8800, 10)
  })
})

describe('latestVersion', () => {
  const v = (id: string, profileId: string, createdAt: string, deletedAt: string | null = null) => ({ id, profileId, createdAt, deletedAt })
  it('neueste nicht gelöschte Version des Profils', () => {
    const list = [v('a1', 'a', '2026-10-01'), v('a2', 'a', '2026-10-10'), v('b1', 'b', '2026-10-20'), v('a3', 'a', '2026-10-15', '2026-10-16')]
    expect(latestVersion(list, 'a')?.id).toBe('a2')
    expect(latestVersion(list, 'x')).toBeNull()
  })
})

describe('profileStatus', () => {
  const versions = [
    { id: 'aufbau1', profileId: 'aufbau', createdAt: '2026-09-01', deletedAt: null },
    { id: 'aufbau2', profileId: 'aufbau', createdAt: '2026-10-05', deletedAt: null },
    { id: 'diaet1', profileId: 'diaet', createdAt: '2026-10-01', deletedAt: null },
  ]
  const a = (id: string, validFrom: string, versionId: string, createdAt = `${validFrom}T08:00:00.000Z`, deletedAt: string | null = null) => ({
    id,
    ...assignment(validFrom, versionId, null, createdAt, deletedAt),
  })

  it('aktiv seit dem ersten Tag der Strecke, auch über neue Versionen hinweg', () => {
    const list = [a('1', '2026-09-01', 'aufbau1'), a('2', '2026-10-05', 'aufbau2')]
    expect(profileStatus(list, versions, '2026-10-21')).toMatchObject({ activeProfileId: 'aufbau', activeSince: '2026-09-01', scheduled: null })
  })

  it('nach einem Wechsel zählt die Strecke ab dem Wechsel', () => {
    const list = [a('1', '2026-09-01', 'aufbau1'), a('2', '2026-10-12', 'diaet1'), a('3', '2026-10-19', 'aufbau2')]
    expect(profileStatus(list, versions, '2026-10-21')).toMatchObject({ activeProfileId: 'aufbau', activeSince: '2026-10-19' })
  })

  it('geplanter Wechsel ab nächstem Montag', () => {
    const list = [a('1', '2026-09-01', 'aufbau1'), a('2', '2026-10-26', 'diaet1')]
    const s = profileStatus(list, versions, '2026-10-21')
    expect(s.activeProfileId).toBe('aufbau')
    expect(s.scheduled).toMatchObject({ id: '2', validFrom: '2026-10-26', profileId: 'diaet' })
  })

  it('gleicher Tag zweimal: zuletzt angelegte gilt, auch für „aktiv seit“', () => {
    const list = [
      a('1', '2026-09-01', 'aufbau1'),
      a('2', '2026-10-21', 'diaet1', '2026-10-21T08:00:00.000Z'),
      a('3', '2026-10-21', 'aufbau2', '2026-10-21T09:00:00.000Z'),
    ]
    expect(profileStatus(list, versions, '2026-10-21')).toMatchObject({ activeProfileId: 'aufbau', activeSince: '2026-09-01' })
  })

  it('ohne Zuweisung, gelöschte zählen nicht', () => {
    expect(profileStatus([], versions, '2026-10-21')).toEqual({ activeProfileId: null, activeSince: null, scheduled: null })
    const list = [a('1', '2026-09-01', 'aufbau1'), a('2', '2026-10-26', 'diaet1', undefined, '2026-10-22T00:00:00.000Z')]
    expect(profileStatus(list, versions, '2026-10-21').scheduled).toBeNull()
  })
})

describe('targetsChanged', () => {
  const t = {
    weeklyKcal: 19600,
    protein: { mode: 'gPerKg' as const, value: 1.8 },
    fat: { mode: 'percent' as const, value: 25 },
    carbs: { mode: 'rest' as const, value: null },
    fiberG: 30,
    waterMl: null,
    manualWeightKg: 74,
  }
  it('gleich / Budget / Modus / Gewicht', () => {
    expect(targetsChanged(t, { ...t })).toBe(false)
    expect(targetsChanged(t, { ...t, weeklyKcal: 15400 })).toBe(true)
    expect(targetsChanged(t, { ...t, fat: { mode: 'g', value: 25 } })).toBe(true)
    expect(targetsChanged(t, { ...t, manualWeightKg: 75 })).toBe(true)
  })
})
