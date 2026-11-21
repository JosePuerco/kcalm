import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db.ts'
import { fetchWeights } from './garminWeights.ts'
import { memoryPushStorage, type PushNet } from './push.ts'
import { newRecord } from './records.ts'
import type { Weight } from './types.ts'
import { setEstimateEnabled } from './weights.ts'

const URL_A = 'https://kcalm-api.dunkleschokola.de'
const TOKEN = 'test-token-0123456789-abcdefghij'
const T0 = new Date('2026-10-26T10:00:00.000Z')
const NOW = new Date('2026-11-21T10:00:00.000Z')
const UPDATED = '2026-11-21T09:50:00.000Z'

const remote = (date: string, kg: number, measuredAt = `${date}T05:30:00.000Z`) => ({ date, kg, measuredAt })
const body = (...items: ReturnType<typeof remote>[]) => ({ ok: true, from: '2026-09-01', updatedAt: UPDATED, items })

function net(response: () => Response | Promise<Response>, seen: string[] = []): PushNet {
  return {
    timeoutMs: 1000,
    newId: () => 'x',
    fetch: async (url, init) => {
      seen.push(`${init?.method ?? 'GET'} ${String(url)} ${(init?.headers as Record<string, string>).Authorization}`)
      return response()
    },
  }
}

const ok = (json: unknown) => () => new Response(JSON.stringify(json), { status: 200 })
const on = () => memoryPushStorage({ enabled: true, serverUrl: URL_A, token: TOKEN, suggestions: true })
const active = async () => (await db.weights.orderBy('date').toArray()).filter((w) => w.deletedAt === null)

beforeEach(async () => {
  await db.weights.clear()
  await db.settings.clear()
})

describe('fetchWeights', () => {
  it('Schalter aus → off, keine Anfrage, vorhandene Gewichte unverändert', async () => {
    const before = newRecord<Weight>({ date: '2026-10-12', kg: 77.2, source: 'health', measuredAt: '2026-10-12T09:33:00.000Z' }, T0)
    await db.weights.put(before)
    const seen: string[] = []
    const off = memoryPushStorage({ enabled: true, serverUrl: URL_A, token: TOKEN, suggestions: false })
    expect(await fetchWeights(off, net(ok(body(remote('2026-10-12', 77.239))), seen), NOW)).toBe('off')
    expect(await fetchWeights(memoryPushStorage({ suggestions: true }), net(ok(body()), seen), NOW)).toBe('off')
    expect(seen).toEqual([])
    expect(await db.weights.toArray()).toEqual([before])
  })

  it('GET /v1/weights mit Bearer-Token', async () => {
    const seen: string[] = []
    await fetchWeights(on(), net(ok(body(remote('2026-10-12', 77.239))), seen), NOW)
    expect(seen).toEqual([`GET ${URL_A}/v1/weights Bearer ${TOKEN}`])
  })

  it('ersetzt Kurzbefehl-Gewichte durch Garmin', async () => {
    await db.weights.put(newRecord<Weight>({ date: '2026-10-12', kg: 77.2, source: 'health', measuredAt: '2026-10-12T09:33:00.000Z' }, T0))
    const result = await fetchWeights(on(), net(ok(body(remote('2026-10-12', 77.239, '2026-10-12T05:53:00.000Z'), remote('2026-10-14', 74.79)))), NOW)
    expect(result).toBe('ok')
    expect((await active()).map((w) => [w.date, w.kg, w.source, w.measuredAt])).toEqual([
      ['2026-10-12', 77.239, 'garmin', '2026-10-12T05:53:00.000Z'],
      ['2026-10-14', 74.79, 'garmin', '2026-10-14T05:30:00.000Z'],
    ])
  })

  it('zweites Abholen ohne Änderung → updatedAt aller Gewichte unverändert', async () => {
    const list = ok(body(remote('2026-10-12', 77.239), remote('2026-10-14', 74.79)))
    await fetchWeights(on(), net(list), NOW)
    const first = await db.weights.toArray()
    await fetchWeights(on(), net(list), new Date('2026-11-21T11:00:00.000Z'))
    expect(await db.weights.toArray()).toEqual(first)
  })

  it('Verbrauchsschätzung aus → Gewichte werden trotzdem gespeichert', async () => {
    await setEstimateEnabled(false, NOW)
    expect(await fetchWeights(on(), net(ok(body(remote('2026-10-12', 77.239)))), NOW)).toBe('ok')
    expect(await active()).toHaveLength(1)
  })

  it('kaputte Antwort → failed, Gewichte unverändert, lastError gesetzt', async () => {
    const before = newRecord<Weight>({ date: '2026-10-12', kg: 77.2, source: 'health', measuredAt: '2026-10-12T09:33:00.000Z' }, T0)
    await db.weights.put(before)
    const storage = on()
    expect(await fetchWeights(storage, net(ok({ ok: true, from: '2026-09-01', updatedAt: UPDATED, items: [remote('2026-10-12', 5)] })), NOW)).toBe(
      'failed',
    )
    expect(await db.weights.toArray()).toEqual([before])
    expect(storage.loadInboxState().lastError).toBe('Unerwartete Antwort vom Server')
  })

  it('Fehler beim Gewicht überschreibt nicht lastSuccessAt der Vorschläge', async () => {
    const storage = on()
    storage.saveInboxState({ lastSuccessAt: '2026-11-21T09:00:00.000Z', lastError: null })
    await fetchWeights(storage, net(() => new Response('{}', { status: 401 })), NOW)
    expect(storage.loadInboxState()).toEqual({ lastSuccessAt: '2026-11-21T09:00:00.000Z', lastError: 'Token wird nicht akzeptiert' })
  })

  it('Erfolg beim Gewicht löscht keinen lastError der Vorschläge', async () => {
    const storage = on()
    storage.saveInboxState({ lastSuccessAt: null, lastError: 'Server nicht erreichbar' })
    await fetchWeights(storage, net(ok(body(remote('2026-10-12', 77.239)))), NOW)
    expect(storage.loadInboxState()).toEqual({ lastSuccessAt: null, lastError: 'Server nicht erreichbar' })
  })
})
