// Kalenderdaten als „YYYY-MM-DD“. Gerechnet wird in UTC, damit Sommer-/Winterzeit nie einen Tag verschluckt.
// Wochen beginnen am Montag, Tage um Mitternacht (lokale Zeit).

import type { LocalDate } from '../db/types.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const pad = (n: number) => String(n).padStart(2, '0')

/** Lokales Kalenderdatum eines Zeitpunkts: 21.10.2026 00:30 Ortszeit → „2026-10-21“ */
export function toLocalDate(date: Date): LocalDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toUtcMs(date: LocalDate): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) throw new RangeError(`Ungültiges Datum: ${date}`)
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const ms = Date.UTC(y, m - 1, d)
  // 2026-02-30 würde sonst still zum 2. März
  if (new Date(ms).getUTCDate() !== d) throw new RangeError(`Ungültiges Datum: ${date}`)
  return ms
}

function fromUtcMs(ms: number): LocalDate {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Datum ± n Tage */
export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS)
}

/** Tage von a bis b (b − a), z. B. Mo → Do = 3 */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS)
}

/** Wochentag 0 = Montag … 6 = Sonntag */
export function weekdayIndex(date: LocalDate): number {
  return (new Date(toUtcMs(date)).getUTCDay() + 6) % 7
}

/** Montag der Woche, in der das Datum liegt */
export function weekStart(date: LocalDate): LocalDate {
  return addDays(date, -weekdayIndex(date))
}

/** Alle sieben Tage der Woche, Montag bis Sonntag */
export function weekDates(date: LocalDate): LocalDate[] {
  const monday = weekStart(date)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/** Nächster Montag nach dem Datum; an einem Montag der in einer Woche */
export function nextMonday(date: LocalDate): LocalDate {
  return addDays(weekStart(date), 7)
}

/** Verbleibende Tage der Woche inklusive des Datums: Mo → 7, Do → 4, So → 1 */
export function daysLeftInWeek(date: LocalDate): number {
  return 7 - weekdayIndex(date)
}

/**
 * Kalenderwoche nach ISO 8601: KW 1 ist die Woche mit dem ersten Donnerstag des Jahres.
 * 2026-12-31 (Do) → 53, 2027-01-01 (Fr) → 53, 2027-01-04 (Mo) → 1
 */
export function isoWeek(date: LocalDate): number {
  // Der Donnerstag derselben Woche bestimmt das Jahr der KW
  const thursday = addDays(weekStart(date), 3)
  const jan1 = `${thursday.slice(0, 4)}-01-01`
  return Math.floor(daysBetween(jan1, thursday) / 7) + 1
}
