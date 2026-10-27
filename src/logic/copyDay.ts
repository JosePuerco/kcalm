// Tag oder Slot kopieren, „Wie gestern“ (Leer.dc.html). Kopien übernehmen die gespeicherten Nährwerte
// des Quelltags (Snapshot), nur das Datum ist neu. Reine Funktion.

import type { Entry, LocalDate } from '../db/types.ts'
import type { NewEntryFields } from './addFood.ts'

export interface CopyOptions {
  slotId?: string
  targetSlotId?: string
}

/**
 * Felder der Kopien für den Zieltag, in der Reihenfolge der Anlage.
 * slotId: nur diesen Slot kopieren. targetSlotId: alles in diesen Slot statt in den gleichen (Phase 12d).
 * Mahlzeiten-Gruppen bekommen neue Gruppen-ids, damit Kopie und Original getrennt bearbeitet werden können.
 */
export function copiedEntries(
  source: readonly Entry[],
  targetDate: LocalDate,
  options: CopyOptions & { newId?: () => string } = {},
): NewEntryFields[] {
  const newId = options.newId ?? (() => crypto.randomUUID())
  const groups = new Map<string, string>()
  return source
    .filter((e) => e.deletedAt === null && (options.slotId === undefined || e.slotId === options.slotId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((e) => {
      let mealGroupId: string | null = null
      if (e.mealGroupId !== null) {
        mealGroupId = groups.get(e.mealGroupId) ?? newId()
        groups.set(e.mealGroupId, mealGroupId)
      }
      return {
        date: targetDate,
        slotId: options.targetSlotId ?? e.slotId,
        kind: e.kind,
        ref: e.ref,
        nameSnapshot: e.nameSnapshot,
        amount: e.amount,
        unit: e.unit,
        portionLabel: e.portionLabel,
        nutrients: { ...e.nutrients },
        mealGroupId,
        mealName: e.mealName,
      }
    })
}

/** Toast: „11 Einträge übernommen“ */
export function copiedMessage(count: number): string {
  return count === 1 ? '1 Eintrag übernommen' : `${count} Einträge übernommen`
}
