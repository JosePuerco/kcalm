// Tage als „vollständig getrackt“ markieren (Grundlage für Verbrauchsschätzung und Monatsauswertung).
// Ein Datensatz je Datum; wieder abschalten setzt complete auf false statt zu löschen.

import { db } from './db.ts'
import { upsertByKey } from './records.ts'
import type { Day, LocalDate } from './types.ts'

export async function setDayComplete(date: LocalDate, complete: boolean, now = new Date()): Promise<void> {
  await db.transaction('rw', db.days, async () => {
    const existing = await db.days.where('date').equals(date).first()
    await db.days.put(upsertByKey<Day>(existing, { date, complete }, now))
  })
}

export async function isDayComplete(date: LocalDate): Promise<boolean> {
  const day = await db.days.where('date').equals(date).first()
  return day?.deletedAt === null && day.complete
}
