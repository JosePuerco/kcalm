// Eingabelogik des eigenen Ziffernblocks (Dezimalkomma, keine iPhone-Tastatur).
// Der Wert bleibt ein Text, damit „12,“ während der Eingabe sichtbar bleibt.

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'del'

/** Tastenreihenfolge 3 × 4 wie im Prototyp */
export const KEYPAD_LAYOUT: readonly KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del']

/** Höchstlänge der Eingabe inkl. Komma (wie im Prototyp) */
export const KEYPAD_MAX_LENGTH = 6

export function applyKey(value: string, key: KeypadKey, maxLength = KEYPAD_MAX_LENGTH): string {
  if (key === 'del') return value.slice(0, -1)
  if (key === ',') {
    if (value.includes(',') || value.length >= maxLength) return value
    return (value === '' ? '0' : value) + ','
  }
  if (value.length >= maxLength) return value
  // Führende Null ersetzen: „0“ + „5“ → „5“, aber „0,“ + „5“ → „0,5“
  if (value === '0') return key
  return value + key
}

/** „12,5“ → 12.5; leere Eingabe → null; „12,“ → 12 */
export function parseKeypadValue(value: string): number | null {
  if (value === '') return null
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
