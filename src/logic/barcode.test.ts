import { describe, expect, it } from 'vitest'
import { barcodeVariants, expandUpcE, formatEan, hasValidCheckDigit, normalizeBarcode } from './barcode.ts'

describe('hasValidCheckDigit', () => {
  it('erkennt gültige Codes', () => {
    expect(hasValidCheckDigit('4000417025005')).toBe(true) // Ritter Sport Marzipan, EAN-13
    expect(hasValidCheckDigit('96385074')).toBe(true) // EAN-8
    expect(hasValidCheckDigit('036000291452')).toBe(true) // UPC-A
  })

  it('erkennt falsche Prüfziffer und vertauschte Ziffern', () => {
    expect(hasValidCheckDigit('4000417025006')).toBe(false)
    expect(hasValidCheckDigit('4000471025005')).toBe(false)
  })

  it('lehnt zu kurze, zu lange und Nicht-Ziffern ab', () => {
    expect(hasValidCheckDigit('1234567')).toBe(false)
    expect(hasValidCheckDigit('123456789012345')).toBe(false)
    expect(hasValidCheckDigit('40004170250a5')).toBe(false)
    expect(hasValidCheckDigit('')).toBe(false)
  })
})

describe('expandUpcE', () => {
  it('schreibt alle vier Regeln richtig aus', () => {
    // 8 Stellen: Nummernsystem, 6 Datenziffern, Prüfziffer; die 6. Datenziffer wählt die Regel
    expect(expandUpcE('01234558')).toBe('012345000058') // 5–9
    expect(expandUpcE('04252614')).toBe('042100005264') // 0–2 (Beispiel aus der UPC-Norm)
    expect(expandUpcE('01234505')).toBe('012000003455') // 0–2
    expect(expandUpcE('01234531')).toBe('012300000451') // 3
    expect(expandUpcE('01234543')).toBe('012340000053') // 4
  })

  it('null bei falscher Prüfziffer oder Nummernsystem 2–9', () => {
    expect(expandUpcE('01234559')).toBeNull()
    expect(expandUpcE('21234505')).toBeNull()
    expect(expandUpcE('0123450')).toBeNull()
  })
})

describe('normalizeBarcode', () => {
  it('EAN-13 bleibt, Leerzeichen und Striche fallen weg', () => {
    expect(normalizeBarcode('4000417025005')).toBe('4000417025005')
    expect(normalizeBarcode(' 4 000417 025005 ')).toBe('4000417025005')
    expect(normalizeBarcode('4000-417-025005')).toBe('4000417025005')
  })

  it('UPC-A bekommt eine führende 0', () => {
    expect(normalizeBarcode('036000291452')).toBe('0036000291452')
    expect(normalizeBarcode('036000291452', 'upc_a')).toBe('0036000291452')
  })

  it('EAN-8 bleibt 8-stellig', () => {
    expect(normalizeBarcode('96385074')).toBe('96385074')
    expect(normalizeBarcode('96385074', 'ean_8')).toBe('96385074')
  })

  it('UPC-E wird zu UPC-A ausgeschrieben, auch ohne Formatangabe', () => {
    expect(normalizeBarcode('04252614', 'upc_e')).toBe('0042100005264')
    expect(normalizeBarcode('04252614')).toBe('0042100005264') // als EAN-8 ungültig
  })

  it('8 Stellen, als EAN-8 und UPC-E gültig: von Hand gilt EAN-8, beim Scan das Format', () => {
    expect(normalizeBarcode('01234558')).toBe('01234558')
    expect(normalizeBarcode('01234558', 'upc_e')).toBe('0012345000058')
  })

  it('Scanner-Format entscheidet bei 8 Stellen', () => {
    expect(normalizeBarcode('04252614', 'ean_8')).toBeNull()
    expect(normalizeBarcode('96385074', 'upc_e')).toBeNull() // gültiges EAN-8, aber kein UPC-E
  })

  it('ungültige Eingaben ergeben null', () => {
    expect(normalizeBarcode('')).toBeNull()
    expect(normalizeBarcode('abc')).toBeNull()
    expect(normalizeBarcode('4000417025006')).toBeNull() // Prüfziffer falsch
    expect(normalizeBarcode('12345')).toBeNull()
    expect(normalizeBarcode('04000417025005')).toBeNull() // GTIN-14 nicht vorgesehen
    expect(normalizeBarcode('4,000417025005')).toBeNull()
  })
})

describe('formatEan', () => {
  it('gruppiert wie auf der Packung', () => {
    expect(formatEan('4012345678901')).toBe('4 012345 678901')
    expect(formatEan('96385074')).toBe('9638 5074')
    expect(formatEan('abc')).toBe('abc')
  })
})

describe('barcodeVariants', () => {
  it('führende 0 auch ohne, für eigene Produkte mit eingetipptem UPC-A', () => {
    expect(barcodeVariants('0036000291452')).toEqual(['0036000291452', '036000291452'])
    expect(barcodeVariants('4000417025005')).toEqual(['4000417025005'])
    expect(barcodeVariants('96385074')).toEqual(['96385074'])
  })
})
