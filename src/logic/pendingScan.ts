// Texte zu gemerkten Scans (NichtGefunden.dc.html, Zustand Offline; Liste in der Tagesansicht). Reine Funktionen.

import type { LocalDate } from '../db/types.ts'
import { dayLabel } from './diary.ts'

/** „Abend · heute“; ohne Bezug zu heute/gestern/morgen mit Datum: „Abend · Mi 21.10.“; ohne Slot nur der Tag */
export function rememberedFor(slotName: string | null, date: LocalDate, today: LocalDate): string {
  const label = dayLabel(date, today)
  const day = label.relative?.toLowerCase() ?? label.date
  return slotName ? `${slotName} · ${day}` : day
}

/** „1 gemerkter Scan“, „2 gemerkte Scans“ */
export function pendingCountLabel(count: number): string {
  return count === 1 ? '1 gemerkter Scan' : `${count} gemerkte Scans`
}

export type PendingStatus = 'ready' | 'notFound' | 'noNutrients' | 'loading' | 'waiting'

/** Zustand eines Scans: Produkt schon lokal, Ergebnis des Nachladens, läuft gerade, noch offen */
export function pendingStatus(
  hasProduct: boolean,
  outcome: 'notFound' | 'noNutrients' | undefined,
  syncing: boolean,
): PendingStatus {
  if (hasProduct) return 'ready'
  if (outcome) return outcome
  return syncing ? 'loading' : 'waiting'
}

export const PENDING_STATUS_TEXT: Record<Exclude<PendingStatus, 'ready'>, string> = {
  notFound: 'Nicht in Open Food Facts',
  noNutrients: 'Ohne Nährwerte',
  loading: 'Wird geladen …',
  waiting: 'Noch nicht geladen',
}
