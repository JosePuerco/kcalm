// Gewichte für die Verbrauchsschätzung: Import aus der Zwischenablage, manuell eintragen, löschen.
// Ein Wert pro Tag; Regeln in src/logic/weightImport.ts.

import { mergeWeights, MAX_KG, MIN_KG, parseWeights } from '../logic/weightImport.ts'
import { db } from './db.ts'
import { newRecord, softDelete, touch } from './records.ts'
import { getSetting, setSetting } from './settings.ts'
import { ESTIMATE_KEY } from './setup.ts'
import type { LocalDate, Weight } from './types.ts'

export async function getEstimateEnabled(): Promise<boolean> {
  return (await getSetting<boolean>(ESTIMATE_KEY)) === true
}

export async function setEstimateEnabled(enabled: boolean, now = new Date()): Promise<void> {
  // Ausschalten löscht keine Gewichte; beim Wiedereinschalten ist alles noch da
  await setSetting(ESTIMATE_KEY, enabled, now)
}

/** Nicht gelöschte Gewichte, nach Datum sortiert */
export async function getWeights(): Promise<Weight[]> {
  const all = await db.weights.orderBy('date').toArray()
  return all.filter((w) => w.deletedAt === null)
}

export type ImportWeightsResult =
  | { ok: true; read: number; created: number; updated: number; duplicates: number }
  | { ok: false; error: string }

/** Text vom Kurzbefehl prüfen und übernehmen; bei einem Fehler wird nichts gespeichert */
export async function importWeights(text: string, now = new Date()): Promise<ImportWeightsResult> {
  const parsed = parseWeights(text)
  if (!parsed.ok) return parsed
  return db.transaction('rw', db.weights, async () => {
    const merge = mergeWeights(await db.weights.toArray(), parsed.samples, 'health', now)
    await db.weights.bulkPut([...merge.created, ...merge.updated])
    return {
      ok: true,
      read: merge.read,
      created: merge.created.length,
      updated: merge.updated.length,
      duplicates: merge.duplicates,
    }
  })
}

/**
 * Gewicht eines Tages von Hand setzen; ersetzt einen vorhandenen Wert. Als Zeitpunkt gilt Mitternacht
 * (bzw. der vorhandene, falls früher), damit ein späterer Import aus Health die Eingabe nicht überschreibt.
 */
export async function setManualWeight(date: LocalDate, kg: number, now = new Date()): Promise<void> {
  if (!Number.isFinite(kg) || kg < MIN_KG || kg > MAX_KG) throw new RangeError(`Gewicht außerhalb ${MIN_KG}–${MAX_KG} kg`)
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const midnight = new Date(y, m - 1, d).toISOString()
  await db.transaction('rw', db.weights, async () => {
    const existing = (await db.weights.where('date').equals(date).toArray()).find((w) => w.deletedAt === null)
    if (existing) {
      const measuredAt = Date.parse(existing.measuredAt) < Date.parse(midnight) ? existing.measuredAt : midnight
      await db.weights.put(touch(existing, { kg, source: 'manual', measuredAt }, now))
    } else {
      await db.weights.add(newRecord<Weight>({ date, kg, source: 'manual', measuredAt: midnight }, now))
    }
  })
}

export async function deleteWeight(id: string, now = new Date()): Promise<void> {
  await db.transaction('rw', db.weights, async () => {
    const weight = await db.weights.get(id)
    if (weight && weight.deletedAt === null) await db.weights.put(softDelete(weight, now))
  })
}
