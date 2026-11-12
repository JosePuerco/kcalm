import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import { PUSH_BATCH_SIZE, type PushBody } from '../logic/push.ts'
import { createBackup, replaceWithBackup } from './backup.ts'
import { db } from './db.ts'
import { memoryPushStorage, pendingPushCount, pushNow, runPush, type PushNet } from './push.ts'
import { newRecord, softDelete, touch } from './records.ts'
import type { Entry, ProfileAssignment, ProfileVersion } from './types.ts'

const URL_A = 'https://kcalm-api.dunkleschokola.de'
const URL_B = 'https://anderer-server.example'
const TOKEN = 'test-token-0123456789-abcdefghij'
// Do 12.11.2026
const NOW = new Date('2026-11-12T18:00:00.000Z')
const LATER = new Date('2026-11-12T19:00:00.000Z')

type Mode = 'up' | 'offline' | 'dropResponse' | 'unauthorized' | 'error' | 'timeout' | 'garbage'

/** Nachbau des Servers (kcalm-server/src/push.ts) mit Fehlerschaltern */
class FakeServer {
  records = new Map<string, { record: object; deleted: boolean; removed: boolean; syncId: string | null }>()
  requests: PushBody[] = []
  mode: Mode = 'up'
  /** Nach so vielen erfolgreichen Anfragen geht der Server offline */
  failAfter: number | null = null

  live(table: string) {
    return [...this.records.entries()]
      .filter(([key, r]) => key.startsWith(`${table}:`) && !r.deleted && !r.removed)
      .map(([, r]) => r.record as Record<string, unknown>)
  }

  net(newIds = ['voll-1', 'voll-2', 'voll-3', 'voll-4']): PushNet {
    const ids = [...newIds]
    return {
      timeoutMs: 1000,
      newId: () => ids.shift() ?? 'voll-x',
      fetch: async (_url, init) => {
        expect(String(_url)).toMatch(/\/v1\/push$/)
        if (this.failAfter !== null && this.requests.length >= this.failAfter) this.mode = 'offline'
        const headers = init?.headers as Record<string, string>
        if (this.mode === 'offline') throw new TypeError('Failed to fetch')
        if (this.mode === 'timeout') throw Object.assign(new Error('timeout'), { name: 'TimeoutError' })
        if (this.mode === 'unauthorized' || headers.Authorization !== `Bearer ${TOKEN}`) {
          return new Response('{"ok":false}', { status: 401 })
        }
        if (this.mode === 'error') return new Response('{"ok":false}', { status: 500 })
        if (this.mode === 'garbage') return new Response('<html>Cloudflare</html>', { status: 200 })
        const body = JSON.parse(init?.body as string) as PushBody
        this.requests.push(body)
        this.apply(body)
        if (this.mode === 'dropResponse') throw new TypeError('Network connection was lost')
        return Response.json({ ok: true })
      },
    }
  }

  apply(body: PushBody) {
    const syncId = body.fullSync?.id ?? null
    for (const u of body.upserts) {
      const prev = this.records.get(`${u.table}:${u.id}`)
      this.records.set(`${u.table}:${u.id}`, {
        record: u.record,
        deleted: (u.record as { deletedAt?: string | null }).deletedAt != null,
        removed: false,
        syncId: syncId ?? prev?.syncId ?? null,
      })
    }
    for (const r of body.removals) {
      const prev = this.records.get(`${r.table}:${r.id}`)
      if (prev) prev.removed = true
    }
    if (body.fullSync?.last) {
      for (const r of this.records.values()) if (r.syncId !== body.fullSync.id) r.removed = true
    }
  }
}

function entry(date = '2026-11-12', kcal = 300): Entry {
  return newRecord<Entry>(
    {
      date,
      slotId: 'slot-1',
      kind: 'food',
      ref: 'bls:C133000',
      nameSnapshot: 'Haferflocken',
      amount: 60,
      unit: 'g',
      portionLabel: null,
      nutrients: { kcal, fat: 4, satFat: 0.7, carbs: 35, sugar: 0.5, fiber: 6, protein: 8, salt: null },
      mealGroupId: null,
      mealName: null,
      cost: null,
    },
    NOW,
  )
}

async function addProfile() {
  const version = newRecord<ProfileVersion>(
    {
      profileId: 'p1',
      weeklyKcal: 14000,
      protein: { mode: 'g', value: 150 },
      fat: { mode: 'percent', value: 30 },
      carbs: { mode: 'rest', value: null },
      fiberG: 30,
      manualWeightKg: null,
    },
    NOW,
  )
  await db.profileVersions.add(version)
  await db.profileAssignments.add(
    newRecord<ProfileAssignment>({ validFrom: '2026-11-09', profileVersionId: version.id, weekBudgetOverride: null }, NOW),
  )
}

const enabled = () => memoryPushStorage({ enabled: true, serverUrl: URL_A, token: TOKEN })
const allIds = (s: FakeServer) => s.live('entries').map((r) => r.id as string).sort()
const upserted = (body: PushBody | undefined, table = 'entries') =>
  (body?.upserts ?? []).filter((u) => u.table === table).map((u) => u.id)

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('Einstellungen', () => {
  it('aus → nichts gesendet', async () => {
    const server = new FakeServer()
    await db.entries.add(entry())
    expect(await runPush(memoryPushStorage(), server.net(), NOW)).toEqual({ kind: 'disabled' })
    expect(server.requests).toEqual([])
  })

  it('an, aber Adresse oder Token ungültig → Hinweis, nichts gesendet', async () => {
    const server = new FakeServer()
    const http = memoryPushStorage({ enabled: true, serverUrl: 'http://pi.local:3000', token: TOKEN })
    expect(await runPush(http, server.net(), NOW)).toEqual({ kind: 'invalidConfig', error: 'Adresse muss mit https:// beginnen' })
    const short = memoryPushStorage({ enabled: true, serverUrl: URL_A, token: 'kurz' })
    expect((await runPush(short, server.net(), NOW)).kind).toBe('invalidConfig')
    expect(server.requests).toEqual([])
  })
})

describe('Erst-Upload', () => {
  it('sendet alles als Vollabgleich, danach ist nichts mehr ausstehend', async () => {
    const server = new FakeServer()
    const storage = enabled()
    const entries = [entry(), entry('2026-11-11'), softDelete(entry('2026-11-10'), NOW)]
    await db.entries.bulkAdd(entries)
    await addProfile()
    expect(await pendingPushCount(storage, NOW)).toBe(3 + 2 + 7) // Einträge, Profil, 7 Tagesziele

    const outcome = await runPush(storage, server.net(), NOW)
    expect(outcome).toEqual({ kind: 'ok', sent: 12, full: true })
    expect(server.requests).toHaveLength(1)
    expect(server.requests[0]!.fullSync).toEqual({ id: 'voll-1', last: true })
    expect(allIds(server)).toEqual([entries[0]!.id, entries[1]!.id].sort())
    expect(server.live('dailyTargets')).toHaveLength(7)
    expect(storage.loadState()).toMatchObject({
      receiptsFor: URL_A,
      fullSyncId: null,
      lastSuccessAt: NOW.toISOString(),
      lastError: null,
    })

    expect(await pendingPushCount(storage, NOW)).toBe(0)
    expect(await runPush(storage, server.net(), LATER)).toEqual({ kind: 'nothing' })
    expect(server.requests).toHaveLength(1)
  })

  it('leere App: ein leeres Paket mit last = true, danach nichts mehr', async () => {
    const server = new FakeServer()
    const storage = enabled()
    expect(await runPush(storage, server.net(), NOW)).toEqual({ kind: 'ok', sent: 0, full: true })
    expect(server.requests).toEqual([{ formatVersion: 1, upserts: [], removals: [], fullSync: { id: 'voll-1', last: true } }])
    expect(await runPush(storage, server.net(), NOW)).toEqual({ kind: 'nothing' })
  })

  it('viele Daten: Pakete à 500, nur das letzte mit last = true', async () => {
    const server = new FakeServer()
    await db.entries.bulkAdd(Array.from({ length: PUSH_BATCH_SIZE * 2 + 1 }, () => entry()))
    await runPush(enabled(), server.net(), NOW)
    expect(server.requests.map((r) => [r.upserts.length, r.fullSync?.last])).toEqual([
      [500, false],
      [500, false],
      [1, true],
    ])
    expect(server.live('entries')).toHaveLength(1001)
  })
})

describe('Anlegen, ändern, löschen', () => {
  async function synced() {
    const server = new FakeServer()
    const storage = enabled()
    const e = entry()
    await db.entries.add(e)
    await runPush(storage, server.net(), NOW)
    server.requests.length = 0
    return { server, storage, e }
  }

  it('neuer Eintrag → nur dieser wird gesendet', async () => {
    const { server, storage } = await synced()
    const neu = entry()
    await db.entries.add(neu)
    expect(await pendingPushCount(storage, LATER)).toBe(1)
    expect(await runPush(storage, server.net(), LATER)).toEqual({ kind: 'ok', sent: 1, full: false })
    expect(upserted(server.requests[0])).toEqual([neu.id])
    expect(server.requests[0]!.fullSync).toBeUndefined()
  })

  it('geänderter Eintrag → neuer Stand kommt an', async () => {
    const { server, storage, e } = await synced()
    await db.entries.put(touch(e, { amount: 90 }, LATER))
    await runPush(storage, server.net(), LATER)
    expect(server.live('entries')).toEqual([expect.objectContaining({ id: e.id, amount: 90 })])
  })

  it('auf einen anderen Tag verschoben → kommt mit neuem Datum an', async () => {
    const { server, storage, e } = await synced()
    await db.entries.put(touch(e, { date: '2026-11-05' }, LATER))
    await runPush(storage, server.net(), LATER)
    expect(server.live('entries')).toEqual([expect.objectContaining({ date: '2026-11-05' })])
  })

  it('gelöschter Eintrag (Löschmarker) → kommt mit deletedAt an', async () => {
    const { server, storage, e } = await synced()
    await db.entries.put(softDelete(e, LATER))
    await runPush(storage, server.net(), LATER)
    expect(server.live('entries')).toEqual([])
    expect(server.requests[0]!.upserts[0]!.record).toMatchObject({ deletedAt: LATER.toISOString() })
  })

  it('Backup „Alles ersetzen“ ohne einen Eintrag → als entfernt gemeldet', async () => {
    const { server, storage, e } = await synced()
    const backup = await createBackup(NOW)
    const other = entry()
    await db.entries.add(other)
    await runPush(storage, server.net(), LATER)
    // Ersetzen mit dem älteren Backup: other verschwindet lokal echt
    await replaceWithBackup(backup, LATER)
    await runPush(storage, server.net(), LATER)
    expect(server.requests.at(-1)!.removals).toEqual([{ table: 'entries', id: other.id }])
    expect(allIds(server)).toEqual([e.id])
  })

  it('Tagesziele: nachgetragener Eintrag sendet ihn und nur die betroffenen Tage', async () => {
    const server = new FakeServer()
    const storage = enabled()
    await addProfile()
    await runPush(storage, server.net(), NOW)
    server.requests.length = 0
    await db.entries.add(entry('2026-11-10', 1000))
    await runPush(storage, server.net(), NOW)
    expect(upserted(server.requests[0], 'dailyTargets')).toEqual(['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'])
  })
})

describe('Doppelt senden', () => {
  it('Antwort geht verloren: erneutes Senden, auf dem Server trotzdem nur einmal', async () => {
    const server = new FakeServer()
    const storage = enabled()
    await db.entries.add(entry())
    await runPush(storage, server.net(), NOW)

    const neu = entry()
    await db.entries.add(neu)
    server.mode = 'dropResponse'
    expect(await runPush(storage, server.net(), LATER)).toMatchObject({ kind: 'failed', error: 'Server nicht erreichbar' })
    expect(server.live('entries')).toHaveLength(2) // angekommen, aber nicht quittiert
    expect(await pendingPushCount(storage, LATER)).toBe(1)

    server.mode = 'up'
    expect(await runPush(storage, server.net(), LATER)).toEqual({ kind: 'ok', sent: 1, full: false })
    expect(server.live('entries')).toHaveLength(2)
    expect(await pendingPushCount(storage, LATER)).toBe(0)
  })
})

describe('Server offline, danach wieder online', () => {
  it('Änderungen sammeln sich, nichts geht verloren, alles kommt nachher an', async () => {
    const server = new FakeServer()
    const storage = enabled()
    const e = entry()
    await db.entries.add(e)
    await runPush(storage, server.net(), NOW)

    server.mode = 'offline'
    const neu = entry()
    await db.entries.add(neu)
    expect(await runPush(storage, server.net(), LATER)).toEqual({ kind: 'failed', error: 'Server nicht erreichbar', sent: 0, full: false })
    await db.entries.put(touch(e, { amount: 75 }, LATER))
    await db.entries.put(softDelete(neu, LATER))
    const dritter = entry()
    await db.entries.add(dritter)
    await runPush(storage, server.net(), LATER)

    expect(await pendingPushCount(storage, LATER)).toBe(3)
    expect(storage.loadState()).toMatchObject({
      lastSuccessAt: NOW.toISOString(),
      lastAttemptAt: LATER.toISOString(),
      lastError: 'Server nicht erreichbar',
    })

    server.mode = 'up'
    expect(await runPush(storage, server.net(), LATER)).toEqual({ kind: 'ok', sent: 3, full: false })
    expect(server.live('entries').map((r) => [r.id, r.amount]).sort()).toEqual([[e.id, 75], [dritter.id, 60]].sort())
    expect(storage.loadState()).toMatchObject({ lastSuccessAt: LATER.toISOString(), lastError: null })
    expect(await pendingPushCount(storage, LATER)).toBe(0)
  })

  it('Abbruch nach dem ersten Paket: der Rest kommt beim nächsten Mal', async () => {
    const server = new FakeServer()
    const storage = enabled()
    await runPush(storage, server.net(), NOW) // Erst-Upload (leer)
    await db.entries.bulkAdd(Array.from({ length: 1200 }, () => entry()))
    server.failAfter = server.requests.length + 1
    expect(await runPush(storage, server.net(), LATER)).toMatchObject({ kind: 'failed', sent: 500 })
    expect(await pendingPushCount(storage, LATER)).toBe(700)

    server.failAfter = null
    server.mode = 'up'
    expect(await runPush(storage, server.net(), LATER)).toEqual({ kind: 'ok', sent: 700, full: false })
    expect(server.live('entries')).toHaveLength(1200)
  })

  it('unterbrochener Vollabgleich wird vollständig wiederholt, Server danach exakt wie das iPhone', async () => {
    const server = new FakeServer()
    // Alter Serverstand mit einem Eintrag, den es auf dem iPhone nicht mehr gibt
    server.records.set('entries:verwaist', { record: { id: 'verwaist' }, deleted: false, removed: false, syncId: null })
    const storage = enabled()
    await db.entries.bulkAdd(Array.from({ length: 1200 }, () => entry()))
    server.failAfter = 1
    expect(await runPush(storage, server.net(['voll-1']), NOW)).toMatchObject({ kind: 'failed', full: true, sent: 500 })
    expect(storage.loadState().fullSyncId).toBe('voll-1')
    expect(server.live('entries')).toHaveLength(501) // noch nichts entfernt

    server.failAfter = null
    server.mode = 'up'
    expect(await runPush(storage, server.net(['voll-2']), LATER)).toEqual({ kind: 'ok', sent: 1200, full: true })
    expect(server.live('entries')).toHaveLength(1200)
    expect(server.records.get('entries:verwaist')!.removed).toBe(true)
    expect(storage.loadState()).toMatchObject({ receiptsFor: URL_A, fullSyncId: null })
  })

  it('Zeitüberschreitung, Token falsch, Serverfehler, kaputte Antwort: nichts quittiert, Fehlertext', async () => {
    const cases: [Mode, string][] = [
      ['timeout', 'Server antwortet nicht (Zeitüberschreitung)'],
      ['unauthorized', 'Token wird nicht akzeptiert'],
      ['error', 'Serverfehler (500)'],
      ['garbage', 'Unerwartete Antwort vom Server'],
    ]
    for (const [mode, error] of cases) {
      await Promise.all(db.tables.map((t) => t.clear()))
      const server = new FakeServer()
      server.mode = mode
      const storage = enabled()
      await db.entries.add(entry())
      expect(await runPush(storage, server.net(), NOW)).toMatchObject({ kind: 'failed', error })
      expect(storage.loadState().lastError).toBe(error)
      expect(await db.pushState.count()).toBe(0)
    }
  })
})

describe('Server-Adresse geändert', () => {
  it('neuer Server bekommt einen Vollabgleich', async () => {
    const a = new FakeServer()
    const b = new FakeServer()
    const storage = enabled()
    await db.entries.add(entry())
    await runPush(storage, a.net(), NOW)

    storage.saveConfig({ ...storage.loadConfig(), serverUrl: `${URL_B}/` })
    expect(await pendingPushCount(storage, NOW)).toBe(1)
    expect(await runPush(storage, b.net(), LATER)).toEqual({ kind: 'ok', sent: 1, full: true })
    expect(b.live('entries')).toHaveLength(1)
    expect(storage.loadState().receiptsFor).toBe(URL_B)
  })

  it('Zustand verloren (localStorage gelöscht) → Vollabgleich statt Lücke', async () => {
    const server = new FakeServer()
    const storage = enabled()
    await db.entries.add(entry())
    await runPush(storage, server.net(), NOW)
    const fresh = memoryPushStorage(storage.loadConfig())
    expect(await runPush(fresh, server.net(), LATER)).toMatchObject({ kind: 'ok', full: true })
  })
})

describe('Sperre', () => {
  it('gleichzeitige Aufrufe senden nicht doppelt', async () => {
    const server = new FakeServer()
    const storage = enabled()
    await db.entries.add(entry())
    const net = server.net()
    const first = pushNow(storage, net, () => NOW)
    const second = pushNow(storage, net, () => NOW)
    expect(second).toBe(first)
    expect(await first).toMatchObject({ kind: 'ok' })
    expect(server.requests).toHaveLength(1)
  })

  it('Änderung während des Sendens wird im Nachlauf mitgenommen', async () => {
    const server = new FakeServer()
    const storage = enabled()
    await runPush(storage, server.net(), NOW) // Erst-Upload (leer)
    const late = entry()
    const net = server.net()
    const slowNet: PushNet = {
      ...net,
      fetch: async (url, init) => {
        const response = await net.fetch(url, init)
        if (server.requests.length === 2) {
          // Während das erste Paket unterwegs ist: neuer Eintrag und neuer Auslöser
          await db.entries.add(late)
          void pushNow(storage, slowNet, () => NOW)
        }
        return response
      },
    }
    await db.entries.add(entry())
    expect(await pushNow(storage, slowNet, () => NOW)).toMatchObject({ kind: 'ok', sent: 1 })
    expect(server.requests).toHaveLength(3)
    expect(upserted(server.requests[2])).toEqual([late.id])
    expect(await pendingPushCount(storage, NOW)).toBe(0)
  })
})

describe('Backup', () => {
  it('enthält weder Quittungsliste noch Token', async () => {
    const server = new FakeServer()
    const storage = enabled()
    await db.entries.add(entry())
    await runPush(storage, server.net(), NOW)
    expect(await db.pushState.count()).toBe(1)
    const backup = await createBackup(LATER)
    expect(Object.keys(backup.tables)).not.toContain('pushState')
    expect(JSON.stringify(backup)).not.toContain(TOKEN)
    expect(JSON.stringify(backup)).not.toContain(URL_A)
  })
})
