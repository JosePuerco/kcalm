import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db.ts'
import { loadExportData } from './export.ts'
import { newRecord, softDelete, unknownNutrients } from './records.ts'
import type { Day, Entry, Weight } from './types.ts'
import { setEstimateEnabled } from './weights.ts'

function entry(date: string) {
  return newRecord<Entry>({
    date,
    slotId: 's',
    kind: 'quick',
    ref: null,
    nameSnapshot: 'Test',
    amount: null,
    unit: null,
    portionLabel: null,
    nutrients: { ...unknownNutrients(), kcal: 500 },
    mealGroupId: null,
    mealName: null,
    cost: null,
  })
}

function weight(date: string) {
  return newRecord<Weight>({ date, kg: 74, source: 'manual', measuredAt: `${date}T00:00:00.000Z` })
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('loadExportData', () => {
  it('ohne gelöschte Datensätze; nur markierte Tage zählen als vollständig', async () => {
    await db.entries.bulkAdd([entry('2026-09-02'), softDelete(entry('2026-09-01'))])
    await db.days.bulkAdd([
      newRecord<Day>({ date: '2026-09-02', complete: true }),
      newRecord<Day>({ date: '2026-09-03', complete: false }),
      softDelete(newRecord<Day>({ date: '2026-09-04', complete: true })),
    ])
    const data = await loadExportData('2026-10-25')
    expect(data.input.entries.map((e) => e.date)).toEqual(['2026-09-02'])
    expect([...data.input.completeDates]).toEqual(['2026-09-02'])
    expect(data.firstDate).toBe('2026-09-02')
  })

  it('erster Tag aus Einträgen und Gewichten, künftige Einträge zählen nicht', async () => {
    await setEstimateEnabled(true)
    await db.entries.bulkAdd([entry('2026-09-10'), entry('2026-11-01')])
    await db.weights.bulkAdd([weight('2026-08-30'), softDelete(weight('2026-08-01'))])
    const data = await loadExportData('2026-10-25')
    expect(data.weightEnabled).toBe(true)
    expect(data.firstDate).toBe('2026-08-30')
    expect(data.input.weights).toHaveLength(1)
  })

  it('ohne Verbrauchsschätzung keine Gewichte, auch nicht für „Alles“', async () => {
    await db.weights.bulkAdd([weight('2026-08-30')])
    const data = await loadExportData('2026-10-25')
    expect(data.weightEnabled).toBe(false)
    expect(data.input.weights).toEqual([])
    expect(data.firstDate).toBeNull()
  })
})
