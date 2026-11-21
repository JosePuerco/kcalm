// Gewicht aus Garmin (PLAN.md Phase 16.2): Die Liste „Tag → erste Wiegung“ von kcalm-server prüfen und die
// gespeicherten Gewichte daran angleichen. Garmin ist die einzige Quelle: Was in der Liste fehlt, wird gelöscht.
// Schutz: Eine leere oder nie geschriebene Liste ändert nichts. Reine Funktionen.

import { z } from 'zod'
import { newRecord, softDelete, touch } from '../db/records.ts'
import type { LocalDate, Timestamp, Weight } from '../db/types.ts'

/** Plausible Grenzen; gleiche Werte prüft kcalm-server */
export const MIN_KG = 20
export const MAX_KG = 300

export interface RemoteWeight {
  date: LocalDate
  kg: number
  measuredAt: Timestamp
}

export interface WeightList {
  from: LocalDate | null
  updatedAt: Timestamp | null
  items: RemoteWeight[]
}

const responseSchema = z.object({
  ok: z.literal(true),
  from: z.iso.date().nullable(),
  updatedAt: z.iso.datetime().nullable(),
  items: z
    .array(z.object({ date: z.iso.date(), kg: z.number().min(MIN_KG).max(MAX_KG), measuredAt: z.iso.datetime() }))
    .refine((items) => new Set(items.map((i) => i.date)).size === items.length, 'Tag doppelt'),
})

/** Antwort von GET /v1/weights; null bei jedem Fehler (dann bleibt alles, wie es ist) */
export function parseWeightList(json: unknown): WeightList | null {
  const parsed = responseSchema.safeParse(json)
  if (!parsed.success) return null
  const { from, updatedAt, items } = parsed.data
  return { from, updatedAt, items: items.map((i) => ({ date: i.date, kg: i.kg, measuredAt: i.measuredAt })) }
}

export interface WeightChanges {
  created: Weight[]
  updated: Weight[]
  deleted: Weight[]
}

/** Gespeicherte Gewichte an die Garmin-Liste angleichen; nur echte Änderungen kommen zurück */
export function reconcileWeights(local: readonly Weight[], list: WeightList, now: Date): WeightChanges {
  const changes: WeightChanges = { created: [], updated: [], deleted: [] }
  if (list.updatedAt === null || list.items.length === 0) return changes

  const remote = new Map(list.items.map((i) => [i.date, i]))
  const kept = new Set<LocalDate>()
  for (const w of local) {
    if (w.deletedAt !== null) continue
    const r = remote.get(w.date)
    if (!r || kept.has(w.date)) {
      changes.deleted.push(softDelete(w, now))
      continue
    }
    kept.add(w.date)
    if (w.kg !== r.kg || w.measuredAt !== r.measuredAt || w.source !== 'garmin') {
      changes.updated.push(touch(w, { kg: r.kg, measuredAt: r.measuredAt, source: 'garmin' }, now))
    }
  }
  for (const r of list.items) {
    if (!kept.has(r.date)) changes.created.push(newRecord<Weight>({ date: r.date, kg: r.kg, measuredAt: r.measuredAt, source: 'garmin' }, now))
  }
  return changes
}
