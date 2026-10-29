import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import { addDays } from '../logic/dates.ts'
import { estimateDates } from '../logic/estimate.ts'
import { db } from './db.ts'
import { loadEstimate } from './estimate.ts'
import { assignVersion, createProfile } from './profiles.ts'
import { newRecord, softDelete, unknownNutrients } from './records.ts'
import type { Day, Entry, Weight } from './types.ts'

const t0 = new Date('2026-09-01T08:00:00.000Z')
const today = '2026-10-22'

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

const weight = (date: string, kg: number) =>
  newRecord<Weight>({ date, kg, source: 'health', measuredAt: `${date}T05:00:00.000Z` })

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('loadEstimate', () => {
  it('leere Datenbank: sammelt, kein Budget', async () => {
    const d = await loadEstimate(today)
    expect(d.estimate.status).toBe('collecting')
    expect(d.budget).toBeNull()
    expect(d.days).toHaveLength(28)
    expect(d.weights).toEqual([])
  })

  it('28 vollständige Tage und tägliche Wiegungen: Ergebnis; gelöschte Daten zählen nicht', async () => {
    const { version } = await createProfile(profile, t0)
    await assignVersion(version.id, { validFrom: '2026-09-01', weekBudgetOverride: null }, t0)
    const dates = estimateDates(today)
    await db.entries.bulkAdd([...dates.map((d) => entry(d, 2500)), softDelete(entry(today, 5000))])
    await db.days.bulkAdd(dates.map((date) => newRecord<Day>({ date, complete: true })))
    await db.weights.bulkAdd([
      ...dates.map((d) => weight(d, 74)),
      softDelete(weight(addDays(dates[0]!, -1), 90)),
    ])

    const d = await loadEstimate(today)
    expect(d.budget).toBe(2800)
    expect(d.weights).toHaveLength(28)
    expect(d.estimate).toMatchObject({ status: 'ready', completeDays: 28, weighings: 28 })
    expect(d.estimate.status === 'ready' && d.estimate.kcal.value).toBeCloseTo(2500, 6)
  })
})
