// Mahlzeiten-Slots: Standardvorschlag, passender Slot zur Uhrzeit, Prüfung des Slot-Editors.

import type { Slot } from '../db/types.ts'

export interface SlotInput {
  /** vorhandener Slot; fehlt bei neuen */
  id?: string
  name: string
  /** „HH:MM“ oder leer */
  timeFrom: string
  timeTo: string
}

/** Vorschlag in der Ersteinrichtung; die Fenster schließen lückenlos aneinander an */
export const DEFAULT_SLOTS: readonly SlotInput[] = [
  { name: 'Frühstück', timeFrom: '04:00', timeTo: '10:30' },
  { name: 'Mittag', timeFrom: '10:30', timeTo: '14:30' },
  { name: 'Snacks', timeFrom: '14:30', timeTo: '17:30' },
  { name: 'Abend', timeFrom: '17:30', timeTo: '04:00' },
]

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** „HH:MM“ → Minuten seit Mitternacht */
function minutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
}

type TimedSlot = Pick<Slot, 'order' | 'timeFrom' | 'timeTo'>

function contains(slot: TimedSlot, time: number): boolean {
  if (!slot.timeFrom || !slot.timeTo) return false
  const from = minutes(slot.timeFrom)
  const to = minutes(slot.timeTo)
  // Fenster über Mitternacht, z. B. 17:30–04:00
  return from < to ? time >= from && time < to : time >= from || time < to
}

/**
 * Slot, der zur Uhrzeit passt („HH:MM“): Start inklusive, Ende exklusive.
 * Überlappen sich Fenster, gewinnt der frühere in der Reihenfolge.
 * Passt keiner, der Slot, dessen Start zuletzt vorbei ist; ohne Uhrzeiten der erste.
 */
export function slotForTime<T extends TimedSlot>(slots: readonly T[], time: string): T | null {
  if (!TIME.test(time)) throw new RangeError(`Ungültige Uhrzeit: ${time}`)
  const sorted = [...slots].sort((a, b) => a.order - b.order)
  const now = minutes(time)
  const hit = sorted.find((s) => contains(s, now))
  if (hit) return hit
  let best: T | null = null
  let bestGap = Infinity
  for (const s of sorted) {
    if (!s.timeFrom) continue
    const gap = (now - minutes(s.timeFrom) + 1440) % 1440
    if (gap < bestGap) {
      best = s
      bestGap = gap
    }
  }
  return best ?? sorted[0] ?? null
}

export const MAX_SLOTS = 8
export const MAX_SLOT_NAME = 30

export type SlotErrors = Record<number, { name?: string; time?: string }>

export type SlotsResult =
  | { ok: true; slots: { id?: string; name: string; timeFrom: string | null; timeTo: string | null }[] }
  | { ok: false; errors: SlotErrors; general?: string }

/** Prüft den Slot-Editor: Name Pflicht und eindeutig, Uhrzeit entweder ganz oder gar nicht */
export function validateSlots(inputs: readonly SlotInput[]): SlotsResult {
  if (inputs.length === 0) return { ok: false, errors: {}, general: 'Mindestens ein Slot' }
  if (inputs.length > MAX_SLOTS) return { ok: false, errors: {}, general: `Höchstens ${MAX_SLOTS} Slots` }

  const errors: SlotErrors = {}
  const seen = new Set<string>()
  inputs.forEach((input, i) => {
    const name = input.name.trim()
    const key = name.toLocaleLowerCase('de-DE')
    const e: SlotErrors[number] = {}
    if (name === '') e.name = 'Bitte benennen'
    else if (name.length > MAX_SLOT_NAME) e.name = `Höchstens ${MAX_SLOT_NAME} Zeichen`
    else if (seen.has(key)) e.name = 'Name schon vergeben'
    seen.add(key)

    const from = input.timeFrom.trim()
    const to = input.timeTo.trim()
    if ((from === '') !== (to === '')) e.time = 'Von und bis angeben oder beide leer lassen'
    else if (from !== '' && (!TIME.test(from) || !TIME.test(to))) e.time = 'Uhrzeit als HH:MM'
    else if (from !== '' && from === to) e.time = 'Von und bis müssen sich unterscheiden'
    if (e.name || e.time) errors[i] = e
  })
  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    slots: inputs.map((input) => ({
      ...(input.id ? { id: input.id } : {}),
      name: input.name.trim(),
      timeFrom: input.timeFrom.trim() || null,
      timeTo: input.timeTo.trim() || null,
    })),
  }
}
