// Daten für die Tagesansicht in einer Abfrage: Einträge der Woche (+ Vortag), Slots, Ziel, vollständige Tage.

import { addDays, weekDates, weekStart } from '../logic/dates.ts'
import { kcalByDate } from '../logic/diary.ts'
import { goalFor } from '../logic/profiles.ts'
import { db } from './db.ts'
import type { Entry, LocalDate, ProfileVersion, Slot } from './types.ts'

export interface DiaryData {
  dayEntries: Entry[]
  weekKcal: Record<LocalDate, number>
  /** Vortag für die Karte „Noch nichts eingetragen“ */
  yesterday: { kcal: number; count: number }
  /** alle nicht gelöschten Slots, auch archivierte (für alte Tage) */
  slots: Slot[]
  goal: { version: ProfileVersion; weekBudget: number; countFrom: LocalDate | null } | null
  /** vollständig markierte Tage im angezeigten Monat */
  completeDates: Set<LocalDate>
  /** angezeigter Tag als vollständig markiert */
  complete: boolean
}

/** month = „YYYY-MM“ des Kalenders */
export async function loadDiary(date: LocalDate, month: string): Promise<DiaryData> {
  const yesterdayDate = addDays(date, -1)
  // Montag: der Vortag liegt in der Woche davor
  const from = yesterdayDate < weekStart(date) ? yesterdayDate : weekStart(date)
  const to = weekDates(date)[6] as LocalDate
  const [entries, slots, assignments, versions, days, day] = await Promise.all([
    db.entries.where('date').between(from, to, true, true).filter((e) => e.deletedAt === null).toArray(),
    db.slots.filter((s) => s.deletedAt === null).toArray(),
    db.profileAssignments.toArray(),
    db.profileVersions.toArray(),
    db.days.filter((d) => d.deletedAt === null && d.complete && d.date.startsWith(month)).toArray(),
    db.days.where('date').equals(date).first(),
  ])
  const byDay = kcalByDate(entries)
  const yesterdayEntries = entries.filter((e) => e.date === yesterdayDate)
  const goal = goalFor(assignments, versions, date)
  return {
    dayEntries: entries.filter((e) => e.date === date),
    weekKcal: byDay,
    yesterday: { kcal: byDay[yesterdayDate] ?? 0, count: yesterdayEntries.length },
    slots,
    goal: goal && { version: goal.version, weekBudget: goal.weekBudget, countFrom: goal.countFrom },
    completeDates: new Set(days.map((d) => d.date)),
    complete: day?.deletedAt === null && day.complete,
  }
}
