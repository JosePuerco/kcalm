import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import { unknownNutrients } from './records.ts'
import { DEFAULT_PUSH_STATE, parseInboxState, parsePushConfig } from '../logic/push.ts'
import type { NewEntryFields } from '../logic/addFood.ts'
import { createBackup, replaceWithBackup } from './backup.ts'
import { db } from './db.ts'
import { acceptSuggestions, countSuggestions, fetchInbox, loadSuggestions, rejectSuggestions } from './inbox.ts'
import { memoryPushStorage, type PushNet } from './push.ts'

const URL_A = 'https://kcalm-api.dunkleschokola.de'
const TOKEN = 'test-token-0123456789-abcdefghij'
const NOW = new Date('2026-11-20T18:00:00.000Z')
const TODAY = '2026-11-20'
const A = '0193a000-0000-7000-8000-000000000001'
const B = '0193a000-0000-7000-8000-000000000002'

function item(id: string, date = TODAY) {
  return {
    id,
    kind: 'entry',
    date,
    createdAt: '2026-11-20T12:00:00.000Z',
    payload: {
      slot: null,
      group: null,
      ref: null,
      name: 'Apfel',
      amount: 150,
      unit: 'g',
      kcal: 78,
      protein: null,
      carbs: null,
      sugar: null,
      fat: null,
      satFat: null,
      fiber: null,
      salt: null,
    },
  }
}

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

const ok = (items: unknown[]) => () => new Response(JSON.stringify({ ok: true, items }), { status: 200 })
const on = () => memoryPushStorage({ enabled: true, serverUrl: URL_A, token: TOKEN, suggestions: true })

function entryFields(): NewEntryFields {
  return {
    date: TODAY,
    slotId: 's1',
    kind: 'quick',
    ref: null,
    nameSnapshot: 'Apfel',
    amount: 150,
    unit: 'g',
    portionLabel: null,
    nutrients: { ...unknownNutrients(), kcal: 78 },
    mealGroupId: null,
    mealName: null,
    cost: null,
    estimated: true,
  }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('Einstellungen', () => {
  it('alter gespeicherter Push ohne suggestions → aus; fehlender Briefkasten-Zustand → leer', () => {
    expect(parsePushConfig(JSON.stringify({ enabled: true, serverUrl: URL_A, token: TOKEN })).suggestions).toBe(false)
    expect(parseInboxState(null)).toEqual({ lastSuccessAt: null, lastError: null })
    expect(parseInboxState('{kaputt')).toEqual({ lastSuccessAt: null, lastError: null })
  })

  it('ein gleichzeitiger Push überschreibt den Zustand des Briefkastens nicht', async () => {
    const storage = on()
    const stale = storage.loadState() // Push liest zu Beginn …
    const failing: PushNet = { timeoutMs: 1000, newId: () => 'x', fetch: async () => Promise.reject(new TypeError('offline')) }
    await fetchInbox(storage, failing, NOW)
    storage.saveState({ ...stale, lastError: 'Server nicht erreichbar' }) // … und schreibt am Ende zurück
    expect(storage.loadInboxState().lastError).toBe('Server nicht erreichbar')
    expect(storage.loadState()).toEqual({ ...DEFAULT_PUSH_STATE, lastError: 'Server nicht erreichbar' })
  })
})

describe('fetchInbox', () => {
  it('ohne Schalter fragt nicht ab', async () => {
    const seen: string[] = []
    const storage = memoryPushStorage({ enabled: true, serverUrl: URL_A, token: TOKEN, suggestions: false })
    expect(await fetchInbox(storage, net(ok([item(A)]), seen), NOW)).toBe('off')
    expect(await fetchInbox(memoryPushStorage({ suggestions: true }), net(ok([item(A)]), seen), NOW)).toBe('off')
    expect(seen).toEqual([])
  })

  it('Erfolg ersetzt den Briefkasten, GET mit Token', async () => {
    await db.inbox.put({ ...item(B), payload: {} })
    const seen: string[] = []
    const storage = on()
    expect(await fetchInbox(storage, net(ok([item(A)]), seen), NOW)).toBe('ok')
    expect(seen).toEqual([`GET ${URL_A}/v1/inbox Bearer ${TOKEN}`])
    expect((await db.inbox.toArray()).map((i) => i.id)).toEqual([A])
    expect(storage.loadInboxState()).toEqual({ lastSuccessAt: NOW.toISOString(), lastError: null })
  })

  it('Netzfehler behält den Briefkasten und merkt sich den Fehler', async () => {
    await db.inbox.put(item(A))
    const storage = on()
    const failing: PushNet = { timeoutMs: 1000, newId: () => 'x', fetch: async () => Promise.reject(new TypeError('offline')) }
    expect(await fetchInbox(storage, failing, NOW)).toBe('failed')
    expect(await db.inbox.count()).toBe(1)
    expect(storage.loadInboxState().lastError).toBe('Server nicht erreichbar')
  })

  it('401 → Token wird nicht akzeptiert', async () => {
    const storage = on()
    await fetchInbox(storage, net(() => new Response('{}', { status: 401 })), NOW)
    expect(storage.loadInboxState().lastError).toBe('Token wird nicht akzeptiert')
  })
})

describe('Anzeigen und Entscheiden', () => {
  it('loadSuggestions zeigt offene Vorschläge des Tages, countSuggestions zählt sie', async () => {
    await db.inbox.bulkPut([item(A), item(B, '2026-11-19')])
    const groups = await loadSuggestions(TODAY, TODAY)
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([[A]])
    expect(await countSuggestions(TODAY, TODAY)).toBe(1)
  })

  it('acceptSuggestions schreibt Einträge und Entscheidungen in einer Transaktion', async () => {
    await db.inbox.bulkPut([item(A), item(B)])
    await acceptSuggestions([entryFields()], [A], [B], NOW)
    const entries = await db.entries.toArray()
    expect(entries).toHaveLength(1)
    expect(await db.inboxDecisions.get(A)).toMatchObject({ id: A, decision: 'accepted', entryIds: [entries[0]!.id], deletedAt: null })
    expect(await db.inboxDecisions.get(B)).toMatchObject({ decision: 'rejected', entryIds: [] })
    expect(await countSuggestions(TODAY, TODAY)).toBe(0)
  })

  it('zweites acceptSuggestions mit derselben id erzeugt keine Einträge', async () => {
    await db.inbox.put(item(A))
    await acceptSuggestions([entryFields()], [A], [], NOW)
    await acceptSuggestions([entryFields()], [A], [], NOW)
    expect(await db.entries.count()).toBe(1)
  })

  it('rejectSuggestions blendet aus, ohne Einträge', async () => {
    await db.inbox.put(item(A))
    await rejectSuggestions([A], NOW)
    expect(await db.entries.count()).toBe(0)
    expect(await countSuggestions(TODAY, TODAY)).toBe(0)
  })

  it('nach Backup-Import mit Entscheidung bleibt der Vorschlag unsichtbar', async () => {
    await db.inbox.put(item(A))
    await rejectSuggestions([A], NOW)
    const backup = await createBackup(NOW)
    await db.delete()
    await db.open()
    await replaceWithBackup(backup)
    await db.inbox.put(item(A)) // erneut abgeholt
    expect(await countSuggestions(TODAY, TODAY)).toBe(0)
  })
})
