// Barcodes prüfen und vereinheitlichen (PLAN.md 3, Barcode-Scanner: EAN-13, EAN-8, UPC-A, UPC-E).
// Einheitsform: EAN-8 bleibt 8-stellig, alles andere wird 13-stellig (UPC-A mit führender 0,
// UPC-E erst zu UPC-A ausgeschrieben). So findet ein Scan dasselbe Produkt, egal in welcher Form.

/** Formate, die der Scanner liefert (Namen wie in der BarcodeDetector-Schnittstelle) */
export type BarcodeFormat = 'ean_13' | 'ean_8' | 'upc_a' | 'upc_e'

export const BARCODE_FORMATS: readonly BarcodeFormat[] = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

/** Prüfziffer nach GTIN: von rechts abwechselnd ×3 und ×1, auf den nächsten Zehner ergänzen */
export function hasValidCheckDigit(digits: string): boolean {
  if (!/^\d{8,14}$/.test(digits)) return false
  let sum = 0
  for (let i = digits.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) {
    sum += Number(digits[i]) * weight
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1])
}

/** UPC-E (8 Stellen, Nummernsystem 0 oder 1) → UPC-A (12 Stellen); null, wenn kein UPC-E */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null
  const [ns, d1, d2, d3, d4, d5, d6, check] = code.split('') as [string, ...string[]] & string[]
  let body: string
  if (d6 === '0' || d6 === '1' || d6 === '2') body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`
  else if (d6 === '3') body = `${d1}${d2}${d3}00000${d4}${d5}`
  else if (d6 === '4') body = `${d1}${d2}${d3}${d4}00000${d5}`
  else body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`
  const upcA = `${ns}${body}${check}`
  return hasValidCheckDigit(upcA) ? upcA : null
}

/**
 * Eingabe oder Scan → Einheitsform, oder null bei ungültigem Code.
 * Ohne Format (Eingabe von Hand) gilt ein 8-stelliger Code zuerst als EAN-8, sonst als UPC-E.
 */
export function normalizeBarcode(raw: string, format?: BarcodeFormat): string | null {
  const digits = raw.replace(/[\s-]/g, '')
  if (!/^\d+$/.test(digits)) return null

  if (digits.length === 8) {
    if (format !== 'upc_e' && hasValidCheckDigit(digits)) return digits
    if (format === 'ean_8') return null
    const upcA = expandUpcE(digits)
    return upcA === null ? null : `0${upcA}`
  }
  if (digits.length === 12) return hasValidCheckDigit(digits) ? `0${digits}` : null
  if (digits.length === 13) return hasValidCheckDigit(digits) ? digits : null
  return null
}

/** Anzeige wie auf der Packung: EAN-13 „4 012345 678901“, EAN-8 „4012 3456“, sonst unverändert */
export function formatEan(code: string): string {
  if (/^\d{13}$/.test(code)) return `${code.slice(0, 1)} ${code.slice(1, 7)} ${code.slice(7)}`
  if (/^\d{8}$/.test(code)) return `${code.slice(0, 4)} ${code.slice(4)}`
  return code
}

/** Schreibweisen, unter denen ein Code lokal gespeichert sein kann (eigene Produkte: so wie eingetippt) */
export function barcodeVariants(code: string): string[] {
  return code.length === 13 && code.startsWith('0') ? [code, code.slice(1)] : [code]
}
