// Gewichte aus Apple Health: Text aus der Zwischenablage (Kurzbefehl „Kcalm Gewichte“, docs/kurzbefehl-gewichte.md)
// lesen, mit Zod prüfen und mit den gespeicherten Gewichten zusammenführen. Reine Funktionen.
//
// Format, eine Messung pro Zeile, Trenner Semikolon (Dezimalkomma bleibt eindeutig):
//   kcalm-gewichte 1
//   2026-10-22T07:12:00+02:00;74,8;kg
//   2026-10-21T06:58:31+02:00;75.1;kg
// Zeitpunkt nach ISO 8601, Gewicht mit Komma oder Punkt, Einheit kg oder lb (fehlt = kg). Leere Zeilen zählen nicht.

import { z } from 'zod'
import { newRecord, touch } from '../db/records.ts'
import type { LocalDate, Weight } from '../db/types.ts'
import { toLocalDate } from './dates.ts'
import { firstPerDay, type WeightSample } from './estimate.ts'

export const WEIGHT_HEADER = 'kcalm-gewichte 1'
/** Plausible Grenzen; alles außerhalb ist ein Tippfehler oder eine falsche Einheit */
export const MIN_KG = 20
export const MAX_KG = 300
const KG_PER_LB = 0.45359237

const sampleSchema = z.object({
  date: z.iso.date(),
  measuredAt: z.iso.datetime(),
  kg: z.number().min(MIN_KG).max(MAX_KG),
})

export type ParseWeightsResult =
  | { ok: true; samples: WeightSample[] }
  | { ok: false; error: string }

// 2026-10-22, 2026-10-22T07:12, 2026-10-22T07:12:00.123+02:00, …Z
const TIME_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/

/**
 * Kalendertag und Zeitpunkt einer Messung. Mit Zeitzone gilt der Tag, wie er im Text steht
 * (die Ortszeit beim Wiegen, auch auf Reisen); bei „Z“ der Tag in der Ortszeit des Geräts;
 * ohne Zeitzone ist die Zeit Ortszeit, ohne Uhrzeit Mitternacht.
 */
function parseTime(text: string): { date: LocalDate; measuredAt: string } | null {
  const m = TIME_RE.exec(text)
  if (!m) return null
  const [, y, mo, d, h = '00', mi = '00', s = '00', zone] = m
  let at: Date
  if (zone) {
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${zone === 'Z' ? 'Z' : zone.replace(/^([+-]\d{2})(\d{2})$/, '$1:$2')}`
    at = new Date(iso)
  } else {
    at = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
  }
  if (Number.isNaN(at.getTime())) return null
  const date = zone && zone !== 'Z' ? `${y}-${mo}-${d}` : toLocalDate(at)
  return { date, measuredAt: at.toISOString() }
}

/** „74,8“, „74.8“, „ 74,80 “ → 74,8; Tausenderpunkte gibt es bei Körpergewicht nicht */
function parseKg(value: string, unit: string): number | null {
  if (!/^\d+([.,]\d+)?$/.test(value)) return null
  const n = Number(value.replace(',', '.'))
  if (unit === 'kg') return n
  if (unit === 'lb' || unit === 'lbs') return n * KG_PER_LB
  return null
}

/**
 * Text aus der Zwischenablage lesen. Streng: Ist eine Zeile kaputt, wird nichts übernommen
 * und der Fehler nennt die Zeile. Mehrere Messungen an einem Tag bleiben hier noch erhalten.
 */
export function parseWeights(text: string): ParseWeightsResult {
  // trim() entfernt auch ein BOM am Anfang
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
  const start = lines.findIndex((l) => l !== '')
  if (start === -1) return { ok: false, error: 'Die Zwischenablage ist leer.' }
  if (lines[start]?.toLowerCase() !== WEIGHT_HEADER) {
    return { ok: false, error: 'Kein Text vom Kurzbefehl „Kcalm Gewichte“ in der Zwischenablage.' }
  }
  const samples: WeightSample[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] as string
    if (line === '') continue
    const [time = '', value = '', unit = 'kg', ...rest] = line.split(';').map((p) => p.trim())
    const at = parseTime(time)
    const kg = rest.length === 0 ? parseKg(value, unit.toLowerCase() || 'kg') : null
    const sample = at && kg !== null ? sampleSchema.safeParse({ ...at, kg }) : null
    if (!sample?.success) {
      const why = at && kg !== null ? ` (Gewicht außerhalb ${MIN_KG}–${MAX_KG} kg)` : ''
      return { ok: false, error: `Zeile ${i + 1} ist nicht lesbar${why}: „${line}“` }
    }
    samples.push(sample.data)
  }
  if (samples.length === 0) return { ok: false, error: 'Keine Gewichte gefunden. Gibt es in Apple Health Werte aus den letzten 60 Tagen?' }
  return { ok: true, samples }
}

export interface WeightMerge {
  /** neue Datensätze */
  created: Weight[]
  /** gespeicherte Tage mit früherer Messung aus dem Import */
  updated: Weight[]
  /** gelesene Messungen */
  read: number
  /** weitere Messungen am selben Tag im Import (die erste zählt) */
  duplicates: number
}

/**
 * Import mit den gespeicherten Gewichten zusammenführen: ein Wert pro Tag, die früheste Messung zählt.
 * Ein gelöschter Tag bleibt gelöscht, wenn genau diese Messung wieder kommt (sonst käme er bei jedem Import zurück).
 */
export function mergeWeights(
  existing: readonly Weight[],
  samples: readonly WeightSample[],
  source: Weight['source'],
  now = new Date(),
): WeightMerge {
  const first = firstPerDay(samples)
  const active = new Map<LocalDate, Weight>()
  const deleted = new Set<string>()
  for (const w of existing) {
    if (w.deletedAt === null) active.set(w.date, w)
    else deleted.add(`${w.date}|${Date.parse(w.measuredAt)}`)
  }
  const created: Weight[] = []
  const updated: Weight[] = []
  for (const s of first) {
    const at = Date.parse(s.measuredAt)
    const stored = active.get(s.date)
    if (stored) {
      if (at < Date.parse(stored.measuredAt)) {
        updated.push(touch(stored, { kg: s.kg, measuredAt: s.measuredAt, source }, now))
      }
    } else if (!deleted.has(`${s.date}|${at}`)) {
      created.push(newRecord<Weight>({ date: s.date, kg: s.kg, measuredAt: s.measuredAt, source }, now))
    }
  }
  return { created, updated, read: samples.length, duplicates: samples.length - first.length }
}
