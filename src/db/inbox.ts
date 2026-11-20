// Vorschläge aus Fitboard (PLAN.md Phase 16): Briefkasten von kcalm-server abholen, lokal ablegen und
// Jans Entscheidungen speichern. Abholen nur mit eingeschaltetem Schalter; Fehler stehen still im Push-Zustand.

import type { NewEntryFields } from '../logic/addFood.ts'
import {
  parseInbox,
  parseInboxItems,
  suggestionsForDay,
  visibleSuggestions,
  type Suggestion,
  type SuggestionGroup,
} from '../logic/inbox.ts'
import { inboxEndpoint, pushErrorMessage, readyConfig, type PushFailure } from '../logic/push.ts'
import { db } from './db.ts'
import { defaultPushNet, type PushNet, type PushStorage } from './push.ts'
import { newRecord } from './records.ts'
import type { Entry, InboxDecision, LocalDate } from './types.ts'

async function get(net: PushNet, serverUrl: string, token: string): Promise<{ json: unknown } | PushFailure> {
  let response: Response
  try {
    response = await net.fetch(inboxEndpoint(serverUrl), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(net.timeoutMs),
      cache: 'no-store',
    })
  } catch (error) {
    return (error as { name?: string } | null)?.name === 'TimeoutError' ? { kind: 'timeout' } : { kind: 'network' }
  }
  if (!response.ok) return { kind: 'http', status: response.status }
  try {
    return { json: await response.json() }
  } catch {
    return { kind: 'invalidResponse' }
  }
}

/**
 * Briefkasten abholen und den lokalen Stand ersetzen. 'off' = Schalter aus oder Push nicht eingerichtet
 * (keine Anfrage); bei Fehlern bleibt der alte Stand.
 */
export async function fetchInbox(storage: PushStorage, net: PushNet = defaultPushNet, now = new Date()): Promise<'off' | 'ok' | 'failed'> {
  const config = storage.loadConfig()
  const ready = readyConfig(config)
  if (!config.suggestions || !ready || !ready.ok) return 'off'

  const result = await get(net, ready.serverUrl, ready.token)
  if ('kind' in result) {
    storage.saveInboxState({ ...storage.loadInboxState(), lastError: pushErrorMessage(result) })
    return 'failed'
  }
  if ((result.json as { ok?: unknown } | null)?.ok !== true) {
    storage.saveInboxState({ ...storage.loadInboxState(), lastError: pushErrorMessage({ kind: 'invalidResponse' }) })
    return 'failed'
  }
  const items = parseInbox(result.json)
  await db.transaction('rw', db.inbox, async () => {
    await db.inbox.clear()
    await db.inbox.bulkPut(items)
  })
  storage.saveInboxState({ lastSuccessAt: now.toISOString(), lastError: null })
  return 'ok'
}

async function visible(today: LocalDate): Promise<Suggestion[]> {
  const [items, decisions] = await Promise.all([db.inbox.toArray(), db.inboxDecisions.toArray()])
  const decided = new Set(decisions.filter((d) => d.deletedAt === null).map((d) => d.id))
  return visibleSuggestions(parseInboxItems(items), decided, today)
}

/** Offene Vorschläge eines Tages, je Foto bzw. Nachricht eine Gruppe */
export async function loadSuggestions(date: LocalDate, today: LocalDate): Promise<SuggestionGroup[]> {
  return suggestionsForDay(await visible(today), date)
}

export async function countSuggestions(date: LocalDate, today: LocalDate): Promise<number> {
  return (await visible(today)).filter((s) => s.date === date).length
}

function decision(id: string, value: InboxDecision['decision'], entryIds: string[], now: Date): InboxDecision {
  return { ...newRecord<InboxDecision>({ decision: value, entryIds }, now), id }
}

/**
 * Übernehmen: Einträge und Entscheidungen in einer Transaktion. Ist einer der übernommenen Vorschläge schon
 * entschieden (zweiter Tipp, zweites Gerät, Backup), entsteht kein Eintrag – nie doppelt im Tagebuch.
 */
export async function acceptSuggestions(
  list: readonly NewEntryFields[],
  acceptedIds: readonly string[],
  rejectedIds: readonly string[],
  now = new Date(),
): Promise<Entry[]> {
  return db.transaction('rw', db.entries, db.inboxDecisions, async () => {
    const existing = await db.inboxDecisions.bulkGet([...acceptedIds, ...rejectedIds])
    const decided = new Set(existing.filter((d) => d && d.deletedAt === null).map((d) => d!.id))
    if (acceptedIds.some((id) => decided.has(id))) return []
    const entries = list.map((fields, i) => newRecord<Entry>(fields, new Date(now.getTime() + i)))
    await db.entries.bulkAdd(entries)
    const entryIds = entries.map((e) => e.id)
    await db.inboxDecisions.bulkPut([
      ...acceptedIds.map((id) => decision(id, 'accepted', entryIds, now)),
      ...rejectedIds.filter((id) => !decided.has(id)).map((id) => decision(id, 'rejected', [], now)),
    ])
    return entries
  })
}

/** Ablehnen: nur Entscheidungen, keine Einträge */
export async function rejectSuggestions(ids: readonly string[], now = new Date()): Promise<void> {
  await db.transaction('rw', db.inboxDecisions, async () => {
    const existing = await db.inboxDecisions.bulkGet([...ids])
    const open = ids.filter((_, i) => !existing[i] || existing[i]!.deletedAt !== null)
    await db.inboxDecisions.bulkPut(open.map((id) => decision(id, 'rejected', [], now)))
  })
}
