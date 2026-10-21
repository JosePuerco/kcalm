// Bestätigung eines Scans: Ein Code gilt erst, wenn er zweimal gleich gelesen wurde.
// Einzelne Fehllesungen (z. B. bei Bewegung) führen so nicht zu einem falschen Produkt.
// Bilder ohne Code setzen nicht zurück (bei ~8 Bildern pro Sekunde fehlt oft eins), ein anderer Code schon.

import { normalizeBarcode, type BarcodeFormat } from './barcode.ts'

export const READS_TO_CONFIRM = 2

export interface ScanState {
  code: string | null
  count: number
}

export const emptyScan: ScanState = { code: null, count: 0 }

export interface RawRead {
  rawValue: string
  format: string
}

/** Erster gültiger Code eines Bildes in Einheitsform; Formate außerhalb von EAN/UPC zählen nicht */
export function firstValidCode(reads: readonly RawRead[]): string | null {
  for (const read of reads) {
    if (!isBarcodeFormat(read.format)) continue
    const code = normalizeBarcode(read.rawValue, read.format)
    if (code) return code
  }
  return null
}

function isBarcodeFormat(format: string): format is BarcodeFormat {
  return format === 'ean_13' || format === 'ean_8' || format === 'upc_a' || format === 'upc_e'
}

/** Nächstes Bild auswerten; confirmed ist der Code, sobald er oft genug gelesen wurde */
export function nextScan(state: ScanState, code: string | null): { state: ScanState; confirmed: string | null } {
  if (code === null) return { state, confirmed: null }
  const count = code === state.code ? state.count + 1 : 1
  const next = { code, count }
  return { state: next, confirmed: count >= READS_TO_CONFIRM ? code : null }
}
