// Nährwerte für eine Menge. Exakt gerechnet, gerundet wird erst in der Anzeige (format.ts).

import { NUTRIENT_KEYS } from '../db/records.ts'
import type { Nutrients, NutrientValue } from '../db/types.ts'

/** Wert pro 100 × Menge ÷ 100; unbekannt (null) bleibt unbekannt */
export function valueForAmount(per100: NutrientValue, amount: number): NutrientValue {
  if (per100 === null) return null
  // Erst multiplizieren, dann teilen: 372 × 60 ÷ 100 = 223,2 ohne Zwischenrundung
  return (per100 * amount) / 100
}

/**
 * Absolute Nährwerte für eine Menge in g bzw. ml.
 * Beispiel: Haferflocken 372 kcal/100 g, 60 g → 223,2 kcal.
 */
export function nutrientsForAmount(per100: Nutrients, amount: number): Nutrients {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(`Ungültige Menge: ${amount}`)
  }
  const result = {} as Nutrients
  for (const key of NUTRIENT_KEYS) result[key] = valueForAmount(per100[key], amount)
  return result
}

/** Summe eines Nährwerts über mehrere Einträge */
export interface NutrientSum {
  /** Summe der bekannten Werte; null = bei allen Einträgen unbekannt */
  value: number | null
  /** Mindestens ein Eintrag unbekannt, andere bekannt → Anzeige „mind. …“ */
  atLeast: boolean
}

/**
 * Summe je Nährwert. Unbekannte Werte werden nicht als 0 gezählt, sondern machen die Summe zu „mind.“.
 * Keine Einträge = bekannt 0.
 */
export function sumNutrients(list: readonly Nutrients[]): Record<keyof Nutrients, NutrientSum> {
  const result = {} as Record<keyof Nutrients, NutrientSum>
  for (const key of NUTRIENT_KEYS) {
    let value: number | null = list.length === 0 ? 0 : null
    let unknown = 0
    for (const n of list) {
      const v = n[key]
      if (v === null) unknown++
      else value = (value ?? 0) + v
    }
    result[key] = { value, atLeast: value !== null && unknown > 0 }
  }
  return result
}
