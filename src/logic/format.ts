// Anzeige im deutschen Format. Gerechnet wird überall exakt, gerundet nur hier.

const cache = new Map<number, Intl.NumberFormat>()

function formatter(decimals: number): Intl.NumberFormat {
  let f = cache.get(decimals)
  if (!f) {
    f = new Intl.NumberFormat('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    cache.set(decimals, f)
  }
  return f
}

/** Zeichen für unbekannte Werte (null) */
export const UNKNOWN = '–'

/**
 * Zahl mit Tausenderpunkt und Dezimalkomma: 1273 → „1.273“, 2.5 (1) → „2,5“.
 * null (= unbekannt) wird zu „–“, nie zu 0.
 */
export function formatNumber(value: number | null, decimals = 0): string {
  if (value === null || !Number.isFinite(value)) return UNKNOWN
  const text = formatter(decimals).format(value)
  // −0 vermeiden: −0,2 auf 0 Stellen gerundet ergibt sonst „-0“
  return /^-0([,.]0*)?$/.test(text) ? text.slice(1) : text
}

/** Menge in g/ml: ganze Zahl ohne Nachkommastelle, sonst eine: 450 → „450“, 12,5 → „12,5“ */
export function formatAmount(value: number): string {
  // Würde die eine Stelle auf „,0“ runden, ganz ohne Komma zeigen
  return formatNumber(value, Math.abs(value - Math.round(value)) < 0.05 ? 0 : 1)
}
