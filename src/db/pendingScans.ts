// Offline gescannte Codes (PLAN.md 2, Offline-Scan): Code wird mit Slot und Tag gemerkt, das Produkt
// später nachgeladen (4d) oder manuell eingetragen. Erledigt = Löschmarker.

import { db } from './db.ts'
import { newRecord, softDelete } from './records.ts'
import type { LocalDate, PendingScan } from './types.ts'

/** Offene Scans, älteste zuerst */
export async function getPendingScans(): Promise<PendingScan[]> {
  const scans = await db.pendingScans.filter((s) => s.deletedAt === null).toArray()
  return scans.sort((a, b) => a.scannedAt.localeCompare(b.scannedAt))
}

/** Merkt einen Scan; derselbe Code für denselben Slot und Tag wird nur aktualisiert, nicht doppelt gemerkt */
export async function addPendingScan(
  barcode: string,
  slotId: string | null,
  date: LocalDate | null,
  now = new Date(),
): Promise<PendingScan> {
  return db.transaction('rw', db.pendingScans, async () => {
    const same = await db.pendingScans
      .where('barcode')
      .equals(barcode)
      .filter((s) => s.deletedAt === null && s.slotId === slotId && s.date === date)
      .first()
    const stamp = now.toISOString()
    if (same) {
      const updated = { ...same, scannedAt: stamp, updatedAt: stamp }
      await db.pendingScans.put(updated)
      return updated
    }
    const scan = newRecord<PendingScan>({ barcode, scannedAt: stamp, slotId, date }, now)
    await db.pendingScans.add(scan)
    return scan
  })
}

/** Erledigt (eingetragen oder verworfen) */
export async function resolvePendingScan(id: string, now = new Date()): Promise<void> {
  await db.transaction('rw', db.pendingScans, async () => {
    const scan = await db.pendingScans.get(id)
    if (scan && scan.deletedAt === null) await db.pendingScans.put(softDelete(scan, now))
  })
}
