// Mahlzeiten-Slots speichern. Slots mit Einträgen werden nur archiviert, damit alte Tage sie behalten.

import { db } from './db.ts'
import { newRecord, softDelete, touch } from './records.ts'
import type { Slot } from './types.ts'

/** Aktive Slots in ihrer Reihenfolge */
export async function getSlots(): Promise<Slot[]> {
  const all = await db.slots.orderBy('order').toArray()
  return all.filter((s) => s.deletedAt === null && !s.archived)
}

export interface SlotData {
  /** vorhandener Slot; fehlt bei neuen */
  id?: string
  name: string
  timeFrom: string | null
  timeTo: string | null
}

/**
 * Speichert die Slot-Liste aus dem Editor; die Reihenfolge der Liste wird zu `order`.
 * Nicht mehr enthaltene Slots: mit Einträgen archivieren, sonst löschen.
 */
export async function saveSlots(list: readonly SlotData[], now = new Date()): Promise<Slot[]> {
  return db.transaction('rw', [db.slots, db.entries], async () => {
    const active = await getSlots()
    const byId = new Map(active.map((s) => [s.id, s]))
    const saved: Slot[] = []
    for (const [order, data] of list.entries()) {
      const fields = { name: data.name, timeFrom: data.timeFrom, timeTo: data.timeTo, order }
      const existing = data.id ? byId.get(data.id) : undefined
      const slot = existing ? touch(existing, fields, now) : newRecord<Slot>({ ...fields, archived: false }, now)
      saved.push(slot)
    }
    await db.slots.bulkPut(saved)

    const keep = new Set(saved.map((s) => s.id))
    for (const slot of active) {
      if (keep.has(slot.id)) continue
      const used = await db.entries.filter((e) => e.slotId === slot.id && e.deletedAt === null).count()
      await db.slots.put(used > 0 ? touch(slot, { archived: true }, now) : softDelete(slot, now))
    }
    return saved
  })
}
