// Verifizieren (PLAN.md 2, Produkte): Korrekturschicht über dem Original. Reine Funktionen.
// Das Original (OFF- bzw. BLS-Werte) wird nie geändert; die Korrektur enthält nur abweichende Felder.
// Feld fehlt = Original gilt, Zahl = eigener Wert, null = bewusst unbekannt.

import { NUTRIENT_KEYS } from '../db/records.ts'
import type { NutrientKey, Nutrients, NutrientValue, ProductOverride, Unit } from '../db/types.ts'
import { REQUIRED_NUTRIENTS } from './nutrientInfo.ts'

export type Correction = Partial<Nutrients>

const active = (o: ProductOverride | undefined): o is ProductOverride => !!o && o.deletedAt === null

/**
 * „Meine Werte“: Original mit darübergelegter Korrektur. Gilt immer für neue Einträge: korrigiert heißt
 * geprüft, einen Umschalter auf das Original gibt es nicht mehr (Jan, 29.10.2026).
 */
export function mergeNutrients(original: Nutrients, override: ProductOverride | undefined): Nutrients {
  return active(override) ? applyCorrection(original, override.per100) : original
}

function applyCorrection(original: Nutrients, correction: Correction): Nutrients {
  const result = { ...original }
  for (const key of NUTRIENT_KEYS) if (key in correction) result[key] = correction[key] ?? null
  return result
}

/**
 * Einheit für Anzeige und neue Einträge (Phase 12e): die gewählte, sonst das Original.
 * Die Nährwerte bleiben pro 100 g bzw. ml.
 */
export function effectiveUnit(original: Unit, override: ProductOverride | undefined): Unit {
  return (active(override) && override.unit) || original
}

/** Gespeicherter Wert: gleich dem Original → null (keine Korrektur nötig) */
export function unitOverride(original: Unit, chosen: Unit): Unit | null {
  return chosen === original ? null : chosen
}

export interface CompareRow {
  key: NutrientKey
  original: NutrientValue
  mine: NutrientValue
  /** Meine weicht vom Original ab (auch bekannt ↔ unbekannt) */
  differs: boolean
}

/** Zeilen der Tabelle Original · Meine */
export function compareRows(original: Nutrients, override: ProductOverride | undefined): CompareRow[] {
  const mine = mergeNutrients(original, override)
  return NUTRIENT_KEYS.map((key) => ({ key, original: original[key], mine: mine[key], differs: mine[key] !== original[key] }))
}

/** Für „2 korrigiert“ */
export function countCorrected(original: Nutrients, override: ProductOverride | undefined): number {
  return compareRows(original, override).filter((r) => r.differs).length
}

/** Pflichtangaben der Nährwerttabelle, die in „Meine Werte“ noch unbekannt sind */
export function missingForVerify(mine: Nutrients): NutrientKey[] {
  return REQUIRED_NUTRIENTS.filter((key) => mine[key] === null)
}

/** „Als geprüft markieren“ nur mit allen Pflichtangaben */
export function canVerify(mine: Nutrients): boolean {
  return missingForVerify(mine).length === 0
}

/** Eigene Produkte gelten immer als geprüft (abgeleitet, nicht gespeichert) */
export function isVerified(source: 'off' | 'own' | 'bls', override: ProductOverride | undefined): boolean {
  if (source === 'own') return true
  return active(override) && override.verifiedAt !== null
}

/** Aus bearbeiteten Werten die Korrektur machen: nur Felder, die vom Original abweichen */
export function correctionFromValues(original: Nutrients, edited: Nutrients): Correction {
  const result: Correction = {}
  for (const key of NUTRIENT_KEYS) if (edited[key] !== original[key]) result[key] = edited[key]
  return result
}

/** Ohne Korrekturfelder, Prüfung und eigene Einheit braucht es keinen Datensatz (→ Löschmarker) */
export function isEmptyOverride(per100: Correction, verifiedAt: string | null, unit: Unit | null = null): boolean {
  return verifiedAt === null && unit === null && Object.keys(per100).length === 0
}

/**
 * OFF-Update: Das Original ändert sich, „Meine Werte“ nicht.
 * Felder ohne Korrektur, die OFF geändert hat, werden mit dem alten Wert festgehalten;
 * Korrekturen, die jetzt dem neuen Original entsprechen, fallen weg (Meine bleibt trotzdem gleich).
 */
export function rebaseOnOffUpdate(oldOriginal: Nutrients, newOriginal: Nutrients, correction: Correction): Correction {
  return correctionFromValues(newOriginal, applyCorrection(oldOriginal, correction))
}
