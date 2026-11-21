import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db.ts'
import { loadDiary } from './diary.ts'
import { assignVersion, createProfile } from './profiles.ts'
import { newRecord, unknownNutrients } from './records.ts'
import { loadStats } from './stats.ts'
import type { Day, Entry, LocalDate, Weight } from './types.ts'
import { getEstimateEnabled, getWeights, currentTrendKg, loadGoalTrend, setEstimateEnabled } from './weights.ts'

const t0 = new Date('2026-10-22T08:00:00.000Z')
const t1 = new Date('2026-10-22T09:00:00.000Z')
const gPerKgProfile = {
  name: 'Aufbau',
  weeklyKcal: 19600,
  protein: { mode: 'g' as const, value: 140 },
  fat: { mode: 'g' as const, value: 80 },
  carbs: { mode: 'rest' as const, value: null },
  fiberG: 30,
  manualWeightKg: null as number | null,
}
/** Gewicht wie aus Garmin (Phase 16.2), gemessen um Mitternacht des Tages */
async function addWeight(date: LocalDate, kg: number, now = t0): Promise<void> {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  await db.weights.add(newRecord<Weight>({ date, kg, source: 'garmin', measuredAt: new Date(y, m - 1, d).toISOString() }, now))
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('Schalter Verbrauchsschätzung', () => {
  it('aus, solange nichts gesetzt ist; an und wieder aus', async () => {
    expect(await getEstimateEnabled()).toBe(false)
    await setEstimateEnabled(true, t0)
    expect(await getEstimateEnabled()).toBe(true)
    await setEstimateEnabled(false, t1)
    expect(await getEstimateEnabled()).toBe(false)
  })

  it('Ausschalten lässt die Gewichte stehen', async () => {
    await addWeight('2026-10-22', 74.8, t0)
    await setEstimateEnabled(false, t1)
    expect(await getWeights()).toHaveLength(1)
  })
})

describe('Trend für g/kg-Ziele', () => {
  it('nur bei aktiver Verbrauchsschätzung', async () => {
    await addWeight('2026-10-20', 74, t0)
    expect(await loadGoalTrend('2026-10-22')).toEqual([])
    expect(await currentTrendKg('2026-10-22')).toBeNull()
    await setEstimateEnabled(true, t0)
    expect(await loadGoalTrend('2026-10-22')).toHaveLength(3)
    expect(await currentTrendKg('2026-10-22')).toBe(74)
  })

  it('Tagebuch und Statistik rechnen g/kg mit dem Trendgewicht des Tages', async () => {
    const { version } = await createProfile(
      { ...gPerKgProfile, protein: { mode: 'gPerKg', value: 2 }, manualWeightKg: 70 },
      t0,
    )
    await assignVersion(version.id, { validFrom: '2026-10-01', weekBudgetOverride: null }, t0)
    await addWeight('2026-10-20', 75, t0)
    // aus: manuelles Gewicht
    expect((await loadDiary('2026-10-22', '2026-10')).goal?.trendKg).toBeNull()
    await setEstimateEnabled(true, t0)
    expect((await loadDiary('2026-10-22', '2026-10')).goal?.trendKg).toBe(75)
    // vor der ersten Wiegung kein Trend
    expect((await loadDiary('2026-10-19', '2026-10')).goal?.trendKg).toBeNull()
    await db.entries.add(
      newRecord<Entry>({
        date: '2026-10-21',
        slotId: 's',
        kind: 'quick',
        ref: null,
        nameSnapshot: 'Test',
        amount: null,
        unit: null,
        portionLabel: null,
        nutrients: { ...unknownNutrients(), kcal: 2500 },
        mealGroupId: null,
        mealName: null,
        cost: null,
        estimated: false,
      }),
    )
    await db.days.add(newRecord<Day>({ date: '2026-10-21', complete: true }))
    const stats = await loadStats('2026-10-22', 'week')
    expect(stats.macros.find((m) => m.key === 'protein')?.goal).toBe(150)
  })
})
