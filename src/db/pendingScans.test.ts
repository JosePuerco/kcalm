import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db.ts'
import type { Network } from './off.ts'
import {
  addPendingScan,
  getPendingScans,
  loadPendingItems,
  resolvePendingScan,
  syncPendingScans,
} from './pendingScans.ts'

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

/** OFF-Attrappe: Antwort je Barcode; fehlt der Code, wirft fetch (Netz weg) */
function off(answers: Record<string, unknown>, online = true) {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const code = /product\/(\d+)\.json/.exec(String(input))?.[1] ?? ''
    if (!(code in answers)) throw new TypeError('Load failed')
    const body = answers[code]
    return new Response(JSON.stringify(body), { status: (body as { status: number }).status === 0 ? 404 : 200 })
  })
  const net: Network = { fetch: fetchMock, isOnline: () => online, timeoutMs: 1000 }
  return { net, fetchMock }
}

const found = (name: string, kcal?: number) => ({
  status: 1,
  product: { product_name: name, nutriments: kcal === undefined ? {} : { 'energy-kcal_100g': kcal } },
})

describe('syncPendingScans', () => {
  it('lädt Treffer nach und speichert sie; nicht gefunden und ohne kcal kommen als Ergebnis zurück', async () => {
    const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000)
    await addPendingScan('4002971243802', 'a', '2026-10-21', at(0))
    await addPendingScan('4000000001232', 'a', '2026-10-21', at(1))
    await addPendingScan('4000417025005', 'a', '2026-10-21', at(2))
    const { net } = off({
      '4002971243802': found('Skyr natur', 63),
      '4000000001232': { status: 0 },
      '4000417025005': found('Marzipan'),
    })
    const outcomes = await syncPendingScans(net)

    expect(outcomes.get('4000000001232')).toEqual({ kind: 'notFound' })
    expect(outcomes.get('4000417025005')?.kind).toBe('noNutrients')
    expect(outcomes.has('4002971243802')).toBe(false)
    const items = await loadPendingItems()
    expect(items.map((i) => i.product?.name ?? null)).toEqual(['Skyr natur', null, null])
    // Scans bleiben offen, bis sie eingetragen oder verworfen sind
    expect(await getPendingScans()).toHaveLength(3)
  })

  it('jeder Code nur einmal abgefragt, lokal vorhandene gar nicht', async () => {
    await addPendingScan('4002971243802', 'a', '2026-10-21', T0)
    await addPendingScan('4002971243802', 'b', '2026-10-21', T0)
    const first = off({ '4002971243802': found('Skyr natur', 63) })
    await syncPendingScans(first.net)
    expect(first.fetchMock).toHaveBeenCalledTimes(1)

    const second = off({})
    await syncPendingScans(second.net)
    expect(second.fetchMock).not.toHaveBeenCalled()
  })

  it('bricht ab, sobald das Netz fehlt', async () => {
    await addPendingScan('4002971243802', 'a', '2026-10-21', T0)
    await addPendingScan('4000000001232', 'a', '2026-10-21', T1)
    const { net, fetchMock } = off({})
    expect((await syncPendingScans(net)).size).toBe(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
