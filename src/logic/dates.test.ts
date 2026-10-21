import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  daysLeftInWeek,
  nextMonday,
  toLocalDate,
  weekDates,
  weekStart,
  weekdayIndex,
} from './dates.ts'

describe('toLocalDate', () => {
  it('nimmt das lokale Kalenderdatum', () => {
    expect(toLocalDate(new Date(2026, 9, 21, 0, 30))).toBe('2026-10-21')
    expect(toLocalDate(new Date(2026, 9, 21, 23, 59))).toBe('2026-10-21')
  })

  it('Mitternacht gehört zum neuen Tag', () => {
    expect(toLocalDate(new Date(2026, 9, 22, 0, 0))).toBe('2026-10-22')
  })
})

describe('addDays', () => {
  it('über Monats- und Jahresgrenzen', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('Schaltjahr', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
  })

  it('über die Zeitumstellung ohne Tagesverlust', () => {
    // Winterzeit 25.10.2026, Sommerzeit 28.03.2027
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
    expect(addDays('2027-03-27', 2)).toBe('2027-03-29')
  })

  it('lehnt ungültige Daten ab', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow(RangeError)
    expect(() => addDays('21.10.2026', 1)).toThrow(RangeError)
  })
})

describe('Wochen ab Montag', () => {
  it('weekdayIndex: Montag 0, Sonntag 6', () => {
    expect(weekdayIndex('2026-10-19')).toBe(0) // Mo
    expect(weekdayIndex('2026-10-22')).toBe(3) // Do
    expect(weekdayIndex('2026-10-25')).toBe(6) // So
  })

  it('weekStart: Sonntag gehört zur Woche davor', () => {
    expect(weekStart('2026-10-22')).toBe('2026-10-19')
    expect(weekStart('2026-10-25')).toBe('2026-10-19')
    expect(weekStart('2026-10-19')).toBe('2026-10-19')
    expect(weekStart('2026-10-26')).toBe('2026-10-26')
  })

  it('weekStart über den Jahreswechsel', () => {
    expect(weekStart('2027-01-01')).toBe('2026-12-28')
  })

  it('weekDates: Mo bis So', () => {
    expect(weekDates('2026-10-21')).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ])
  })

  it('nextMonday: immer nach dem Datum, an einem Montag eine Woche später', () => {
    expect(nextMonday('2026-10-21')).toBe('2026-10-26')
    expect(nextMonday('2026-10-25')).toBe('2026-10-26')
    expect(nextMonday('2026-10-19')).toBe('2026-10-26')
  })

  it('daysLeftInWeek inklusive heute', () => {
    expect(daysLeftInWeek('2026-10-19')).toBe(7)
    expect(daysLeftInWeek('2026-10-22')).toBe(4)
    expect(daysLeftInWeek('2026-10-25')).toBe(1)
  })

  it('daysBetween', () => {
    expect(daysBetween('2026-10-19', '2026-10-22')).toBe(3)
    expect(daysBetween('2026-10-22', '2026-10-19')).toBe(-3)
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2) // über die Zeitumstellung
  })
})
