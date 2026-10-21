import { describe, expect, it } from 'vitest'
import { formatAmount, formatDateTime, formatNumber, formatTime, UNKNOWN } from './format.ts'

describe('formatNumber', () => {
  it('setzt Tausenderpunkte', () => {
    expect(formatNumber(1273)).toBe('1.273')
    expect(formatNumber(19600)).toBe('19.600')
    expect(formatNumber(1234567)).toBe('1.234.567')
    expect(formatNumber(999)).toBe('999')
  })

  it('rundet nur für die Anzeige', () => {
    expect(formatNumber(223.2)).toBe('223')
    expect(formatNumber(223.5)).toBe('224')
    expect(formatNumber(77.777, 1)).toBe('77,8')
    expect(formatNumber(0.125, 2)).toBe('0,13')
  })

  it('zeigt feste Nachkommastellen mit Komma', () => {
    expect(formatNumber(2.5, 1)).toBe('2,5')
    expect(formatNumber(2, 1)).toBe('2,0')
    expect(formatNumber(1250.5, 1)).toBe('1.250,5')
  })

  it('behandelt null als unbekannt, nicht als 0', () => {
    expect(formatNumber(null)).toBe(UNKNOWN)
    expect(formatNumber(null, 1)).toBe('–')
  })

  it('fängt NaN und Unendlich ab', () => {
    expect(formatNumber(Number.NaN)).toBe(UNKNOWN)
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe(UNKNOWN)
  })

  it('zeigt negative Zahlen, aber kein „-0“', () => {
    expect(formatNumber(-1325)).toBe('-1.325')
    expect(formatNumber(-0.2)).toBe('0')
    expect(formatNumber(-0.04, 1)).toBe('0,0')
    expect(formatNumber(0)).toBe('0')
  })
})

describe('formatAmount', () => {
  it('ganze Mengen ohne Komma, sonst eine Stelle', () => {
    expect(formatAmount(450)).toBe('450')
    expect(formatAmount(1500)).toBe('1.500')
    expect(formatAmount(12.5)).toBe('12,5')
    expect(formatAmount(0.5)).toBe('0,5')
    expect(formatAmount(99.96)).toBe('100')
    expect(formatAmount(12.25)).toBe('12,3')
  })
})

describe('formatTime / formatDateTime', () => {
  it('lokale Zeit mit führenden Nullen', () => {
    expect(formatTime(new Date(2026, 9, 21, 8, 5))).toBe('08:05')
    expect(formatDateTime(new Date(2026, 9, 21, 18, 4))).toBe('21.10.2026, 18:04')
    expect(formatDateTime(new Date(2026, 0, 5, 0, 0))).toBe('05.01.2026, 00:00')
  })
})
