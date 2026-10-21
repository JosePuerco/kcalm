// Schnelleintrag (Schnell.dc.html): Name optional, kcal + Makros direkt, ohne Produkt.
// Leere Felder sind unbekannt (null), nie 0. Hinweis, wenn die Makros mehr als 10 % von den kcal abweichen.

import { unknownNutrients } from '../db/records.ts'
import type { Entry, LocalDate, NutrientKey } from '../db/types.ts'
import type { EntryChanges, NewEntryFields } from './addFood.ts'
import { formatNumber } from './format.ts'
import { parseKeypadValue } from './keypad.ts'

/** Eingabefelder; Reihenfolge wie im Prototyp, „Weitere Nährwerte“ dahinter */
export type QuickField = 'kcal' | 'protein' | 'carbs' | 'fat' | 'satFat' | 'sugar' | 'fiber' | 'salt'

export const MAIN_MACROS: readonly QuickField[] = ['protein', 'carbs', 'fat']
export const MORE_FIELDS: readonly QuickField[] = ['satFat', 'sugar', 'fiber', 'salt']

export const QUICK_LABEL: Readonly<Record<QuickField, string>> = {
  kcal: 'Energie',
  protein: 'Eiweiß',
  carbs: 'Kohlenh.',
  fat: 'Fett',
  satFat: 'ges. Fetts.',
  sugar: 'Zucker',
  fiber: 'Ballastst.',
  salt: 'Salz',
}

export interface QuickValues {
  name: string
  /** Texte vom Ziffernblock mit Dezimalkomma; leer = unbekannt */
  fields: Record<QuickField, string>
}

export const DEFAULT_QUICK_NAME = 'Schnelleintrag'

export function emptyQuick(): QuickValues {
  return { name: '', fields: { kcal: '', protein: '', carbs: '', fat: '', satFat: '', sugar: '', fiber: '', salt: '' } }
}

/** Werte eines vorhandenen Schnelleintrags fürs Bearbeiten */
export function quickFromEntry(entry: Entry): QuickValues {
  const text = (v: number | null) => (v === null ? '' : String(v).replace('.', ','))
  const values = emptyQuick()
  for (const key of Object.keys(values.fields) as QuickField[]) values.fields[key] = text(entry.nutrients[key])
  return { name: entry.nameSnapshot === DEFAULT_QUICK_NAME ? '' : entry.nameSnapshot, fields: values.fields }
}

export interface MacroCheck {
  /** Eiweiß × 4 + KH × 4 + Fett × 9 */
  fromMacros: number
  /** Abweichung höchstens 10 % der kcal */
  ok: boolean
}

/** Makro-Plausibilität; null, solange kcal oder eines der drei Makros fehlt */
export function macroCheck(values: QuickValues): MacroCheck | null {
  const kcal = parseKeypadValue(values.fields.kcal)
  const [p, c, f] = MAIN_MACROS.map((k) => parseKeypadValue(values.fields[k]))
  if (kcal === null || kcal <= 0 || p == null || c == null || f == null) return null
  const fromMacros = p * 4 + c * 4 + f * 9
  return { fromMacros, ok: Math.abs(fromMacros - kcal) <= kcal * 0.1 }
}

/** „Makros ergeben 832 kcal · passt“ / „… · weicht über 10 % ab“ */
export function macroCheckText(check: MacroCheck): string {
  return `Makros ergeben ${formatNumber(check.fromMacros)} kcal · ${check.ok ? 'passt' : 'weicht über 10 % ab'}`
}

const LIMITS: Record<QuickField, number> = {
  kcal: 10000,
  protein: 1000,
  carbs: 1000,
  fat: 1000,
  satFat: 1000,
  sugar: 1000,
  fiber: 1000,
  salt: 100,
}

export type QuickResult = { ok: true; changes: Pick<Entry, 'nameSnapshot' | 'nutrients'> } | { ok: false; error: string; field?: QuickField }

/** Pflicht sind nur die kcal; die Plausibilität ist nur ein Hinweis und sperrt nichts */
export function validateQuick(values: QuickValues): QuickResult {
  const kcal = parseKeypadValue(values.fields.kcal)
  if (kcal === null || kcal <= 0) return { ok: false, error: 'Bitte kcal eingeben', field: 'kcal' }
  const nutrients = unknownNutrients()
  for (const key of Object.keys(LIMITS) as QuickField[]) {
    const v = parseKeypadValue(values.fields[key])
    if (v !== null && v > LIMITS[key]) {
      return { ok: false, error: `${QUICK_LABEL[key]}: höchstens ${formatNumber(LIMITS[key])}`, field: key }
    }
    nutrients[key as NutrientKey] = v
  }
  const name = values.name.trim().slice(0, 120)
  return { ok: true, changes: { nameSnapshot: name || DEFAULT_QUICK_NAME, nutrients } }
}

/** Neuer Schnelleintrag (ohne Produkt, ohne Menge) */
export function quickEntry(values: QuickValues, date: LocalDate, slotId: string): NewEntryFields {
  const r = validateQuick(values)
  if (!r.ok) throw new RangeError(r.error)
  return {
    date,
    slotId,
    kind: 'quick',
    ref: null,
    ...r.changes,
    amount: null,
    unit: null,
    portionLabel: null,
    waterMl: 0,
    mealGroupId: null,
    mealName: null,
  }
}

/** Änderungen beim Speichern eines bearbeiteten Schnelleintrags (inkl. Verschieben) */
export function editedQuick(values: QuickValues, date: LocalDate, slotId: string): EntryChanges & Pick<Entry, 'nameSnapshot'> {
  const fields = quickEntry(values, date, slotId)
  return {
    date,
    slotId,
    amount: null,
    portionLabel: null,
    nutrients: fields.nutrients,
    nameSnapshot: fields.nameSnapshot,
  }
}
