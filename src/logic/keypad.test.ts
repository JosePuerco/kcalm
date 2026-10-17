import { describe, expect, it } from 'vitest'
import { applyKey, KEYPAD_LAYOUT, parseKeypadValue, type KeypadKey } from './keypad.ts'

const type = (keys: KeypadKey[], start = '') => keys.reduce((v, k) => applyKey(v, k), start)

describe('applyKey', () => {
  it('hängt Ziffern an', () => {
    expect(type(['6', '0'])).toBe('60')
    expect(type(['2', '5', '0'])).toBe('250')
  })

  it('setzt höchstens ein Komma', () => {
    expect(type(['2', ',', '5'])).toBe('2,5')
    expect(type(['2', ',', ',', '5'])).toBe('2,5')
    expect(type(['2', ',', '5', ','])).toBe('2,5')
  })

  it('ergänzt eine 0 vor einem Komma am Anfang', () => {
    expect(type([','])).toBe('0,')
    expect(type([',', '5'])).toBe('0,5')
  })

  it('ersetzt eine führende Null', () => {
    expect(type(['0', '5'])).toBe('5')
    expect(type(['0', '0'])).toBe('0')
    expect(type(['0', ',', '0', '5'])).toBe('0,05')
  })

  it('löscht das letzte Zeichen, auch bei leerer Eingabe', () => {
    expect(type(['1', '2', 'del'])).toBe('1')
    expect(type(['del'])).toBe('')
    expect(type(['2', ',', 'del'])).toBe('2')
  })

  it('begrenzt die Länge', () => {
    expect(type(['1', '2', '3', '4', '5', '6', '7'])).toBe('123456')
    expect(type(['1', '2', '3', '4', '5', '6', ','])).toBe('123456')
    expect(applyKey('123456', 'del')).toBe('12345')
  })

  it('hat 12 Tasten im Raster 3 × 4', () => {
    expect(KEYPAD_LAYOUT).toHaveLength(12)
  })
})

describe('parseKeypadValue', () => {
  it('liest Dezimalkomma', () => {
    expect(parseKeypadValue('2,5')).toBe(2.5)
    expect(parseKeypadValue('250')).toBe(250)
    expect(parseKeypadValue('0,05')).toBe(0.05)
  })

  it('akzeptiert ein Komma am Ende während der Eingabe', () => {
    expect(parseKeypadValue('12,')).toBe(12)
  })

  it('gibt bei leerer Eingabe null zurück', () => {
    expect(parseKeypadValue('')).toBeNull()
  })
})
