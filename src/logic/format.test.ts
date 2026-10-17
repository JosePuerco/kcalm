import { describe, expect, it } from 'vitest'
import { formatNumber, UNKNOWN } from './format.ts'

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
