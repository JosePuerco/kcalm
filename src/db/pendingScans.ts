// Offline gescannte Codes (PLAN.md 2, Offline-Scan): Code wird mit Slot und Tag gemerkt, das Produkt
// später nachgeladen (4d) oder manuell eingetragen. Erledigt = Löschmarker.

import type { OffProduct } from '../logic/off.ts'
import { db } from './db.ts'
import { findProductByBarcode, lookupBarcode, type Network } from './off.ts'
import { newRecord, softDelete } from './records.ts'
import type { LocalDate, PendingScan, Product } from './types.ts'

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

export interface PendingItem {
  scan: PendingScan
  /** schon lokal vorhanden (nachgeladen oder eigenes Produkt) */
  product: Product | undefined
}

/** Für die Liste: offene Scans mit ihrem Produkt, falls schon lokal */
export async function loadPendingItems(): Promise<PendingItem[]> {
  const scans = await getPendingScans()
  return Promise.all(scans.map(async (scan) => ({ scan, product: await findProductByBarcode(scan.barcode) })))
}

/** Ergebnis je Barcode, das nicht in der Datenbank steht (nur für diese Sitzung) */
export type SyncOutcome = { kind: 'notFound' } | { kind: 'noNutrients'; data: OffProduct }

/**
 * Lädt die Produkte offener Scans bei OFF nach (Treffer werden lokal gespeichert).
 * Nacheinander, um OFF zu schonen; ohne Netz bzw. wenn OFF nicht antwortet, bricht sie ab.
 */
export async function syncPendingScans(net?: Network): Promise<Map<string, SyncOutcome>> {
  const outcomes = new Map<string, SyncOutcome>()
  const barcodes = [...new Set((await getPendingScans()).map((s) => s.barcode))]
  for (const barcode of barcodes) {
    const result = await lookupBarcode(barcode, net)
    if (result.kind === 'offline' || result.kind === 'unreachable') break
    if (result.kind === 'notFound') outcomes.set(barcode, { kind: 'notFound' })
    if (result.kind === 'noNutrients') outcomes.set(barcode, { kind: 'noNutrients', data: result.data })
  }
  return outcomes
}
