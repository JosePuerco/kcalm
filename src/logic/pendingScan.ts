// Texte zu gemerkten Scans (NichtGefunden.dc.html, Zustand Offline). Reine Funktionen.

import type { LocalDate } from '../db/types.ts'
import { dayLabel } from './diary.ts'

/** „Abend · heute“; ohne Bezug zu heute/gestern/morgen mit Datum: „Abend · Mi 21.10.“ */
export function rememberedFor(slotName: string, date: LocalDate, today: LocalDate): string {
  const label = dayLabel(date, today)
  return `${slotName} · ${label.relative?.toLowerCase() ?? label.date}`
}
