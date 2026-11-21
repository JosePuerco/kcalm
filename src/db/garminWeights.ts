// Gewicht aus Garmin (PLAN.md Phase 16.2): Liste von kcalm-server abholen und die Gewichte daran angleichen.
// Gleicher Schalter und gleicher Zeitpunkt wie die Vorschläge. Ein Fehler steht still im Briefkasten-Zustand;
// ein Erfolg fasst den Zustand nicht an, damit er den Stand der Vorschläge nicht überdeckt.

import { parseWeightList, reconcileWeights } from '../logic/garminWeights.ts'
import { pushErrorMessage, readyConfig, weightsEndpoint, type PushFailure } from '../logic/push.ts'
import { db } from './db.ts'
import { getJson } from './inbox.ts'
import { defaultPushNet, type PushNet, type PushStorage } from './push.ts'

export async function fetchWeights(storage: PushStorage, net: PushNet = defaultPushNet, now = new Date()): Promise<'off' | 'ok' | 'failed'> {
  const config = storage.loadConfig()
  const ready = readyConfig(config)
  if (!config.suggestions || !ready || !ready.ok) return 'off'

  const fail = (failure: PushFailure) => {
    storage.saveInboxState({ ...storage.loadInboxState(), lastError: pushErrorMessage(failure) })
    return 'failed' as const
  }
  const result = await getJson(net, weightsEndpoint(ready.serverUrl), ready.token)
  if ('kind' in result) return fail(result)
  const list = parseWeightList(result.json)
  if (!list) return fail({ kind: 'invalidResponse' })

  await db.transaction('rw', db.weights, async () => {
    const changes = reconcileWeights(await db.weights.toArray(), list, now)
    const write = [...changes.created, ...changes.updated, ...changes.deleted]
    if (write.length > 0) await db.weights.bulkPut(write)
  })
  return 'ok'
}
