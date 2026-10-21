import { describe, expect, it } from 'vitest'
import { emptyScan, firstValidCode, nextScan, type ScanState } from './scanConfirm.ts'

/** Mehrere Bilder nacheinander auswerten, gibt den ersten bestätigten Code zurück */
function run(codes: (string | null)[]): string | null {
  let state: ScanState = emptyScan
  for (const code of codes) {
    const result = nextScan(state, code)
    if (result.confirmed) return result.confirmed
    state = result.state
  }
  return null
}

describe('nextScan', () => {
  it('ein einzelner Treffer reicht nicht', () => {
    expect(run(['4000417025005'])).toBeNull()
  })

  it('zweimal derselbe Code bestätigt', () => {
    expect(run(['4000417025005', '4000417025005'])).toBe('4000417025005')
  })

  it('Bilder ohne Code dazwischen setzen nicht zurück', () => {
    expect(run(['4000417025005', null, null, '4000417025005'])).toBe('4000417025005')
  })

  it('ein anderer Code dazwischen beginnt von vorn', () => {
    expect(run(['4000417025005', '4002971243802', '4000417025005'])).toBeNull()
    expect(run(['4000417025005', '4002971243802', '4002971243802'])).toBe('4002971243802')
  })
})

describe('firstValidCode', () => {
  it('nimmt EAN/UPC in Einheitsform', () => {
    expect(firstValidCode([{ rawValue: '036000291452', format: 'upc_a' }])).toBe('0036000291452')
  })

  it('überspringt fremde Formate und ungültige Codes', () => {
    expect(
      firstValidCode([
        { rawValue: 'https://example.org', format: 'qr_code' },
        { rawValue: '4000417025006', format: 'ean_13' },
        { rawValue: '96385074', format: 'ean_8' },
      ]),
    ).toBe('96385074')
  })

  it('nichts gelesen', () => {
    expect(firstValidCode([])).toBeNull()
  })
})
