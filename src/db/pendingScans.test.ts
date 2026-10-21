import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db.ts'
import { addPendingScan, getPendingScans, resolvePendingScan } from './pendingScans.ts'

const T0 = new Date('2026-10-21T18:00:00.000Z')
const T1 = new Date('2026-10-21T18:05:00.000Z')

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('pendingScans', () => {
  it('merkt Code mit Slot und Tag', async () => {
    const scan = await addPendingScan('4002971243802', 'slot-abend', '2026-10-21', T0)
    expect(scan).toMatchObject({ barcode: '4002971243802', slotId: 'slot-abend', date: '2026-10-21' })
    expect(scan.scannedAt).toBe(T0.toISOString())
    expect(await getPendingScans()).toHaveLength(1)
  })

  it('derselbe Code im selben Slot und Tag wird nicht doppelt gemerkt', async () => {
    const first = await addPendingScan('4002971243802', 'slot-abend', '2026-10-21', T0)
    const again = await addPendingScan('4002971243802', 'slot-abend', '2026-10-21', T1)
    expect(again.id).toBe(first.id)
    expect(again.scannedAt).toBe(T1.toISOString())
    expect(await getPendingScans()).toHaveLength(1)
  })

  it('anderer Slot oder Tag zählt extra, älteste zuerst', async () => {
    await addPendingScan('4002971243802', 'slot-abend', '2026-10-21', T1)
    await addPendingScan('4002971243802', 'slot-mittag', '2026-10-21', T0)
    await addPendingScan('4002971243802', 'slot-abend', '2026-10-22', T1)
    const scans = await getPendingScans()
    expect(scans).toHaveLength(3)
    expect(scans[0]!.slotId).toBe('slot-mittag')
  })

  it('erledigt = Löschmarker, zählt nicht mehr; danach neu merkbar', async () => {
    const scan = await addPendingScan('4002971243802', 'slot-abend', '2026-10-21', T0)
    await resolvePendingScan(scan.id, T1)
    expect(await getPendingScans()).toEqual([])
    expect((await db.pendingScans.get(scan.id))?.deletedAt).toBe(T1.toISOString())

    const again = await addPendingScan('4002971243802', 'slot-abend', '2026-10-21', T1)
    expect(again.id).not.toBe(scan.id)
  })

  it('unbekannte oder schon erledigte id: nichts passiert', async () => {
    await expect(resolvePendingScan('gibt-es-nicht')).resolves.toBeUndefined()
  })
})
