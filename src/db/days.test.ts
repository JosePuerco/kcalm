import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db.ts'
import { isDayComplete, setDayComplete } from './days.ts'

const t0 = new Date('2026-10-21T20:00:00.000Z')
const t1 = new Date('2026-10-21T21:00:00.000Z')

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('setDayComplete', () => {
  it('ein Datensatz je Tag, an und wieder aus', async () => {
    expect(await isDayComplete('2026-10-21')).toBe(false)
    await setDayComplete('2026-10-21', true, t0)
    expect(await isDayComplete('2026-10-21')).toBe(true)
    await setDayComplete('2026-10-21', false, t1)
    expect(await isDayComplete('2026-10-21')).toBe(false)
    const rows = await db.days.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ complete: false, updatedAt: t1.toISOString(), createdAt: t0.toISOString() })
  })
})
