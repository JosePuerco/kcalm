import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db.ts'
import { assignVersion, createProfile } from './profiles.ts'
import { newRecord, softDelete, unknownNutrients } from './records.ts'
import { loadStats } from './stats.ts'
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

function entry(date: string, kcal: number) {
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
    cost: null,
  })
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('loadStats', () => {
  it('nur Einträge und vollständige Tage des Zeitraums, gelöschte nicht', async () => {
    const { version } = await createProfile(profile, t0)
    await assignVersion(version.id, { validFrom: '2026-10-01', weekBudgetOverride: null }, t0)
    await db.entries.bulkAdd([
      entry('2026-10-18', 9999), // Vorwoche
      entry('2026-10-19', 3000),
      entry('2026-10-20', 2600),
      softDelete(entry('2026-10-20', 700)),
      entry('2026-10-21', 1000),
    ])
    await db.days.bulkAdd([
      newRecord<Day>({ date: '2026-10-18', complete: true }),
      newRecord<Day>({ date: '2026-10-19', complete: true }),
      newRecord<Day>({ date: '2026-10-20', complete: true }),
      softDelete(newRecord<Day>({ date: '2026-10-21', complete: true })),
    ])

    const s = await loadStats('2026-10-22', 'week')
    expect(s.tiles).toEqual({
      avgKcal: { value: 2800, atLeast: false },
      completeDays: 2,
      trackedDays: 3,
      balance: { value: 0, atLeast: false },
    })
    expect(s.goalLine).toBe(2800)
    expect(s.bars.map((b) => b.full)).toEqual([true, true, false, false, false, false, false])

    // 4 Wochen enthalten die Vorwoche
    const m = await loadStats('2026-10-22', 'month')
    expect(m.tiles.completeDays).toBe(3)
  })

  it('leere Datenbank', async () => {
    const s = await loadStats('2026-10-22', 'quarter')
    expect(s.bars).toHaveLength(13)
    expect(s.goalLine).toBeNull()
    expect(s.tiles.avgKcal).toBeNull()
  })
})
