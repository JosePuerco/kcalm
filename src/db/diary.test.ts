import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db.ts'
import { loadDiary } from './diary.ts'
import { assignVersion, createProfile } from './profiles.ts'
import { newRecord, softDelete, unknownNutrients } from './records.ts'
import type { Day, Entry } from './types.ts'

const t0 = new Date('2026-10-01T08:00:00.000Z')

const profile = {
  name: 'Aufbau',
  weeklyKcal: 19600,
  protein: { mode: 'g' as const, value: 140 },
  fat: { mode: 'g' as const, value: 80 },
  carbs: { mode: 'rest' as const, value: null },
  fiberG: 30,
  manualWeightKg: null,
}

function entry(date: string, kcal: number | null) {
  return newRecord<Entry>({
    date,
    slotId: 's',
    kind: 'quick',
    ref: null,
    nameSnapshot: 'Test',
    amount: null,
    unit: null,
    portionLabel: null,
    nutrients: { ...unknownNutrients(), kcal },
    mealGroupId: null,
    mealName: null,
  })
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('loadDiary', () => {
  it('Tag, Woche, Vortag, Ziel und vollständige Tage', async () => {
    const { version } = await createProfile(profile, t0)
    await assignVersion(version.id, { validFrom: '2026-10-01', weekBudgetOverride: null }, t0)
    await db.entries.bulkAdd([
      entry('2026-10-18', 999), // Vorwoche
      entry('2026-10-20', 3100),
      entry('2026-10-21', 2000),
      entry('2026-10-21', 850),
      entry('2026-10-22', 500),
      softDelete(entry('2026-10-22', 700)),
      entry('2026-10-24', 1200), // vorgeplant
    ])
    await db.days.bulkAdd([
      newRecord<Day>({ date: '2026-10-20', complete: true }),
      newRecord<Day>({ date: '2026-10-21', complete: false }),
      newRecord<Day>({ date: '2026-09-30', complete: true }),
    ])

    const d = await loadDiary('2026-10-22', '2026-10')
    expect(d.date).toBe('2026-10-22')
    expect(d.dayEntries.map((e) => e.nutrients.kcal)).toEqual([500])
    expect(d.weekKcal).toEqual({ '2026-10-20': 3100, '2026-10-21': 2850, '2026-10-22': 500, '2026-10-24': 1200 })
    expect(d.yesterday).toEqual({ kcal: 2850, count: 2 })
    expect(d.goal?.weekBudget).toBe(19600)
    expect([...d.completeDates]).toEqual(['2026-10-20'])
    expect(d.complete).toBe(false)
    expect([...d.weekComplete]).toEqual(['2026-10-20'])
    expect((await loadDiary('2026-10-20', '2026-10')).complete).toBe(true)
  })

  it('Montag: Vortag aus der Woche davor, zählt aber nicht zur Woche', async () => {
    await db.entries.bulkAdd([entry('2026-10-18', 2400), entry('2026-10-19', 100)])
    const d = await loadDiary('2026-10-19', '2026-10')
    expect(d.yesterday).toEqual({ kcal: 2400, count: 1 })
    expect(d.goal).toBeNull()
    // weekKcal enthält den Sonntag, die Wochenrechnung (weekDates) ignoriert ihn
    expect(d.weekKcal['2026-10-19']).toBe(100)
  })
})
