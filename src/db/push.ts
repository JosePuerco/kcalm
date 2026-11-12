// Push-Ablauf (Phase 14d): Daten lesen, Ausstehendes bestimmen, in Paketen senden, nach „ok“ quittieren.
// Die Rechenlogik steckt in logic/push.ts und logic/pushTargets.ts; hier nur Datenbank, Netz und Speicher.
//
// Ablauf:
// - Vollabgleich, wenn die Quittungsliste nicht zu dieser Server-Adresse gehört oder ein Vollabgleich
//   unterbrochen wurde: Quittungen leeren, alles mit neuer fullSync-id senden, letztes Paket mit last = true.
// - Sonst nur, was von der Quittungsliste abweicht (Datensätze und Tagesziele).
// - Jedes Paket wird erst nach Antwort { ok: true } quittiert. Fehler → abbrechen, Rest bleibt ausstehend.
// - Ändert sich etwas während des Sendens, passt die Prüfsumme nicht mehr zur Quittung → nächstes Mal.

import { toLocalDate } from '../logic/dates.ts'
import {
  allRecords,
  applyReceipts,
  chunk,
  DEFAULT_PUSH_STATE,
  needsFullSync,
  parsePushConfig,
  parsePushState,
  pendingChanges,
  PUSH_TABLES,
  pushBody,
  pushEndpoint,
  pushErrorMessage,
  readyConfig,
  type PushBody,
  type PushChange,
  type PushConfig,
  type PushFailure,
  type PushReceipt,
  type PushState,
  type PushTables,
} from '../logic/push.ts'
import { dailyTargets, pendingTargetChanges } from '../logic/pushTargets.ts'
import { readAllTables } from './backup.ts'
import { db } from './db.ts'
import { getEstimateEnabled } from './weights.ts'

// --- Speicher für Einstellungen und Zustand ------------------------------------------------------

export interface PushStorage {
  loadConfig(): PushConfig
  saveConfig(config: PushConfig): void
  loadState(): PushState
  saveState(state: PushState): void
}

const CONFIG_KEY = 'kcalm.push.config'
const STATE_KEY = 'kcalm.push.state'

/**
 * localStorage, jeder Zugriff abgesichert (privates Fenster, gesperrter Speicher).
 * Bewusst nicht in der Tabelle settings: die landet im Backup und würde das Token mitnehmen.
 */
export function browserPushStorage(): PushStorage {
  const read = (key: string) => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }
  const write = (key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Ohne Speicher bleibt der Push aus bzw. gleicht beim nächsten Mal vollständig ab
    }
  }
  return {
    loadConfig: () => parsePushConfig(read(CONFIG_KEY)),
    saveConfig: (config) => write(CONFIG_KEY, config),
    loadState: () => parsePushState(read(STATE_KEY)),
    saveState: (state) => write(STATE_KEY, state),
  }
}

/** Für Tests und als Ersatz, wenn kein localStorage da ist */
export function memoryPushStorage(config?: Partial<PushConfig>, state?: Partial<PushState>): PushStorage {
  let c: PushConfig = { ...parsePushConfig(null), ...config }
  let s: PushState = { ...DEFAULT_PUSH_STATE, ...state }
  return {
    loadConfig: () => c,
    saveConfig: (next) => (c = next),
    loadState: () => s,
    saveState: (next) => (s = next),
  }
}

// --- Netz ----------------------------------------------------------------------------------------

export interface PushNet {
  fetch: typeof fetch
  timeoutMs: number
  newId: () => string
}

export const defaultPushNet: PushNet = {
  fetch: (...args) => fetch(...args),
  timeoutMs: 20_000,
  newId: () => crypto.randomUUID(),
}

async function send(net: PushNet, serverUrl: string, token: string, body: PushBody): Promise<PushFailure | null> {
  let response: Response
  try {
    response = await net.fetch(pushEndpoint(serverUrl), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(net.timeoutMs),
      cache: 'no-store',
    })
  } catch (error) {
    return (error as { name?: string } | null)?.name === 'TimeoutError' ? { kind: 'timeout' } : { kind: 'network' }
  }
  if (!response.ok) return { kind: 'http', status: response.status }
  try {
    const json = (await response.json()) as { ok?: unknown } | null
    return json?.ok === true ? null : { kind: 'invalidResponse' }
  } catch {
    return { kind: 'invalidResponse' }
  }
}

// --- Daten ---------------------------------------------------------------------------------------

interface PushData {
  tables: PushTables
  receipts: PushReceipt[]
  targetChanges: (receipts: readonly PushReceipt[]) => PushChange[]
}

async function loadPushData(today: string): Promise<PushData> {
  const [all, receipts, estimateEnabled] = await Promise.all([
    readAllTables(),
    db.pushState.toArray(),
    getEstimateEnabled(),
  ])
  const tables = Object.fromEntries(PUSH_TABLES.map((t) => [t, all[t]])) as unknown as PushTables
  const targets = dailyTargets({
    assignments: all.profileAssignments,
    versions: all.profileVersions,
    entries: all.entries,
    weights: all.weights,
    estimateEnabled,
    today,
  })
  return { tables, receipts, targetChanges: (r) => pendingTargetChanges(targets, r) }
}

/** Quittungen eines bestätigten Pakets speichern */
async function storeReceipts(confirmed: readonly PushChange[]): Promise<void> {
  const put = applyReceipts([], confirmed.filter((c) => c.op === 'upsert'))
  const removed = confirmed.filter((c) => c.op === 'remove').map((c) => [c.table, c.id] as [string, string])
  await db.transaction('rw', db.pushState, async () => {
    if (removed.length > 0) await db.pushState.bulkDelete(removed)
    if (put.length > 0) await db.pushState.bulkPut(put)
  })
}

/** Anzahl ausstehender Änderungen (Datensätze + Tagesziele) für die Statusanzeige */
export async function pendingPushCount(storage: PushStorage, now = new Date()): Promise<number> {
  const data = await loadPushData(toLocalDate(now))
  const ready = readyConfig(storage.loadConfig())
  const full = ready?.ok === true && needsFullSync(storage.loadState(), ready.serverUrl)
  const receipts = full ? [] : data.receipts
  return pendingChanges(data.tables, receipts).length + data.targetChanges(receipts).length
}

// --- Ablauf --------------------------------------------------------------------------------------

export type PushOutcome =
  | { kind: 'disabled' }
  | { kind: 'invalidConfig'; error: string }
  | { kind: 'nothing' }
  | { kind: 'ok'; sent: number; full: boolean }
  | { kind: 'failed'; error: string; sent: number; full: boolean }

/** Ein Durchlauf. Nicht direkt aufrufen, sondern über pushNow (Sperre gegen gleichzeitige Läufe). */
export async function runPush(storage: PushStorage, net: PushNet = defaultPushNet, now = new Date()): Promise<PushOutcome> {
  const ready = readyConfig(storage.loadConfig())
  if (ready === null) return { kind: 'disabled' }
  if (!ready.ok) return { kind: 'invalidConfig', error: ready.error }
  const { serverUrl, token } = ready

  let state = storage.loadState()
  const save = (changes: Partial<PushState>) => {
    state = { ...state, ...changes }
    storage.saveState(state)
  }

  const data = await loadPushData(toLocalDate(now))
  const full = needsFullSync(state, serverUrl)

  let changes: PushChange[]
  let fullSyncId: string | null = null
  if (full) {
    // Neuer Vollabgleich (auch nach Abbruch): alte Quittungen gelten nicht mehr
    fullSyncId = net.newId()
    save({ receiptsFor: null, fullSyncId })
    await db.pushState.clear()
    changes = [...allRecords(data.tables), ...data.targetChanges([])]
  } else {
    changes = [...pendingChanges(data.tables, data.receipts), ...data.targetChanges(data.receipts)]
    if (changes.length === 0) return { kind: 'nothing' }
  }

  // Ein Vollabgleich braucht mindestens ein Paket, damit der Server „last“ bekommt (auch ohne Daten)
  const batches = chunk(changes)
  if (batches.length === 0) batches.push([])

  const stamp = now.toISOString()
  let sent = 0
  for (const [i, batch] of batches.entries()) {
    const fullSync = fullSyncId === null ? undefined : { id: fullSyncId, last: i === batches.length - 1 }
    const failure = await send(net, serverUrl, token, pushBody(batch, fullSync))
    if (failure) {
      const error = pushErrorMessage(failure)
      save({ lastAttemptAt: stamp, lastError: error })
      return { kind: 'failed', error, sent, full }
    }
    await storeReceipts(batch)
    sent += batch.length
  }

  save({
    ...(full ? { receiptsFor: serverUrl, fullSyncId: null } : {}),
    lastAttemptAt: stamp,
    lastSuccessAt: stamp,
    lastError: null,
  })
  return { kind: 'ok', sent, full }
}

// --- Sperre --------------------------------------------------------------------------------------

let running: Promise<PushOutcome> | null = null
let again = false

/**
 * Push anstoßen. Läuft schon einer, wird danach noch einmal geschaut (Änderungen während des Sendens);
 * alle Aufrufer bekommen das Ergebnis des laufenden Durchgangs.
 */
export function pushNow(storage: PushStorage, net: PushNet = defaultPushNet, now: () => Date = () => new Date()): Promise<PushOutcome> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    again = false
    let outcome = await runPush(storage, net, now())
    while (again && outcome.kind === 'ok') {
      again = false
      const next = await runPush(storage, net, now())
      // „nichts mehr zu tun“ überschreibt den Erfolg nicht
      if (next.kind !== 'nothing') outcome = next
    }
    return outcome
  })().finally(() => {
    running = null
  })
  return running
}
