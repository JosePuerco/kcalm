// Bezeichnungen, Einheiten und Anzeige-Rundung der Nährwerte (PLAN.md: kcal ganzzahlig,
// Makros eine Nachkommastelle, Salz zwei).

import type { NutrientKey, NutrientValue } from '../db/types.ts'
import { formatNumber, UNKNOWN } from './format.ts'

export interface NutrientInfo {
  label: string
  unit: 'kcal' | 'g'
  decimals: number
  /** „davon …“: eingerückt unter dem Oberwert */
  sub?: boolean
}

export const NUTRIENT_INFO: Record<NutrientKey, NutrientInfo> = {
  kcal: { label: 'Energie', unit: 'kcal', decimals: 0 },
  fat: { label: 'Fett', unit: 'g', decimals: 1 },
  satFat: { label: 'davon gesättigt', unit: 'g', decimals: 1, sub: true },
  carbs: { label: 'Kohlenhydrate', unit: 'g', decimals: 1 },
  sugar: { label: 'davon Zucker', unit: 'g', decimals: 1, sub: true },
  fiber: { label: 'Ballaststoffe', unit: 'g', decimals: 1 },
  protein: { label: 'Eiweiß', unit: 'g', decimals: 1 },
  salt: { label: 'Salz', unit: 'g', decimals: 2 },
}

/** Die sieben Werte der EU-Nährwerttabelle + Ballaststoffe */
export const MAIN_NUTRIENTS: readonly NutrientKey[] = ['kcal', 'fat', 'satFat', 'carbs', 'sugar', 'fiber', 'protein', 'salt']

/**
 * Pflichtangaben der EU-Nährwerttabelle (LMIV, Art. 30). Müssen beim Anlegen eigener
 * Produkte und beim Prüfen ausgefüllt sein (Entscheidung Jan, 17.10.2026).
 */
export const REQUIRED_NUTRIENTS: readonly NutrientKey[] = ['kcal', 'fat', 'satFat', 'carbs', 'sugar', 'protein', 'salt']

/** „63 kcal“, „0,2 g“, „0,13 g“; unbekannt → „–“ ohne Einheit */
export function formatNutrient(key: NutrientKey, value: NutrientValue): string {
  if (value === null) return UNKNOWN
  const info = NUTRIENT_INFO[key]
  return `${formatNumber(value, info.decimals)} ${info.unit}`
}
