// Formular „Produkt anlegen/bearbeiten“: Text-Eingaben ↔ Produktdaten, Prüfung mit Zod.
// Pflicht: Name und die Werte der EU-Nährwerttabelle. Leeres optionales Feld = unbekannt (null), nie 0.

import { z } from 'zod'
import { NUTRIENT_KEYS } from '../db/records.ts'
import type { NutrientKey, Nutrients, Portion, Product, Unit } from '../db/types.ts'

export interface PortionInput {
  label: string
  amount: string
}

export interface ProductFormValues {
  name: string
  brand: string
  barcode: string
  unit: Unit
  nutrients: Record<NutrientKey, string>
  isDrink: boolean
  portions: PortionInput[]
}

/** Das, was das Formular am Produkt festlegt */
export type ProductFormData = Pick<Product, 'name' | 'brand' | 'barcode' | 'unit' | 'per100' | 'isDrink' | 'portions'>

/** Fehlertext je Feld: „name“, „kcal“, „portions.0.amount“ … */
export type FormErrors = Record<string, string>

export type FormResult = { ok: true; data: ProductFormData } | { ok: false; errors: FormErrors }

export function emptyProductForm(): ProductFormValues {
  const nutrients = {} as Record<NutrientKey, string>
  for (const key of NUTRIENT_KEYS) nutrients[key] = ''
  return { name: '', brand: '', barcode: '', unit: 'g', nutrients, isDrink: false, portions: [] }
}

/** Zahl fürs Eingabefeld: exakt, nur mit Komma (keine Rundung, kein Tausenderpunkt) */
export function toInput(value: number | null): string {
  return value === null ? '' : String(value).replace('.', ',')
}

export function productToForm(p: ProductFormData): ProductFormValues {
  return {
    name: p.name,
    brand: p.brand ?? '',
    barcode: p.barcode ?? '',
    unit: p.unit,
    nutrients: nutrientsToForm(p.per100),
    isDrink: p.isDrink,
    portions: p.portions.map((x) => ({ label: x.label, amount: toInput(x.amount) })),
  }
}

/**
 * „12,5“ / „12.5“ / „12,“ / „,5“ → Zahl; leer → null; sonst 'invalid'.
 * Punkt wird als Dezimalzeichen akzeptiert, weil manche Tastaturen ihn liefern.
 */
export function parseDecimal(text: string): number | null | 'invalid' {
  const t = text.trim()
  if (t === '') return null
  if (!/^(\d+([.,]\d*)?|[.,]\d+)$/.test(t)) return 'invalid'
  return Number(t.replace(',', '.'))
}

const MAX_KCAL = 900 // reines Fett hat ~900 kcal/100 g
const MAX_GRAMS = 100

const REQUIRED = 'Pflichtangabe vom Etikett'
const grams = z.number().max(MAX_GRAMS, `Höchstens ${MAX_GRAMS} g pro 100`)
const requiredGrams = z.number({ error: REQUIRED }).pipe(grams)
const optionalGrams = grams.nullable()

const portionSchema = z.object({
  label: z.string().trim().min(1, 'Bitte benennen').max(40, 'Höchstens 40 Zeichen'),
  amount: z.number({ error: 'Bitte Menge eingeben' }).positive('Mehr als 0').max(10000, 'Höchstens 10.000'),
})

// Pflicht sind die Werte der EU-Nährwerttabelle (REQUIRED_NUTRIENTS); Ballaststoffe und Wasser optional
const schema = z.object({
  name: z.string().trim().min(1, 'Bitte einen Namen eingeben').max(120, 'Höchstens 120 Zeichen'),
  brand: z.string().trim().max(80, 'Höchstens 80 Zeichen'),
  barcode: z
    .string()
    .trim()
    .refine((b) => b === '' || /^\d{6,14}$/.test(b), 'Nur Ziffern, 6 bis 14 Stellen'),
  unit: z.enum(['g', 'ml']),
  per100: z.object({
    kcal: z.number({ error: REQUIRED }).max(MAX_KCAL, `Höchstens ${MAX_KCAL} kcal pro 100`),
    fat: requiredGrams,
    satFat: requiredGrams,
    carbs: requiredGrams,
    sugar: requiredGrams,
    fiber: optionalGrams,
    protein: requiredGrams,
    salt: requiredGrams,
    water: optionalGrams,
  }),
  isDrink: z.boolean(),
  portions: z.array(portionSchema),
})

/** Fehlerpfad von Zod → Feldname im Formular (per100.kcal → kcal) */
function fieldKey(path: PropertyKey[]): string {
  const parts = path[0] === 'per100' ? path.slice(1) : path
  return parts.map(String).join('.')
}

export function validateProductForm(values: ProductFormValues): FormResult {
  const errors: FormErrors = {}

  // 1. Text → Zahl; Tippfehler sofort melden
  const per100 = {} as Nutrients
  for (const key of NUTRIENT_KEYS) {
    const n = parseDecimal(values.nutrients[key])
    if (n === 'invalid') errors[key] = 'Keine gültige Zahl'
    per100[key] = n === 'invalid' ? null : n
  }

  // Komplett leere Portionszeilen ignorieren
  const portionRows = values.portions
    .map((p, index) => ({ ...p, index }))
    .filter((p) => p.label.trim() !== '' || p.amount.trim() !== '')
  const portions = portionRows.map((p) => {
    const n = parseDecimal(p.amount)
    if (n === 'invalid') errors[`portions.${p.index}.amount`] = 'Keine gültige Zahl'
    return { label: p.label, amount: n === 'invalid' ? null : n }
  })

  // 2. Regeln mit Zod
  const result = schema.safeParse({ ...values, per100, portions })
  if (!result.success) {
    for (const issue of result.error.issues) {
      let key = fieldKey(issue.path)
      // Portions-Index auf die Zeile im Formular zurückrechnen (leere Zeilen fehlen ja)
      const m = /^portions\.(\d+)\.(.+)$/.exec(key)
      if (m) key = `portions.${portionRows[Number(m[1])]!.index}.${m[2]}`
      errors[key] ??= issue.message
    }
  }
  // 3. Querprüfungen immer, auch wenn andere Felder Fehler haben (sonst kämen Fehler nacheinander)
  const { fat, satFat, carbs, sugar } = per100
  if (fat !== null && satFat !== null && satFat > fat) errors.satFat ??= 'Mehr als Fett gesamt'
  if (carbs !== null && sugar !== null && sugar > carbs) errors.sugar ??= 'Mehr als Kohlenhydrate gesamt'
  const seen = new Set<string>()
  for (const p of portionRows) {
    const label = p.label.trim().toLowerCase()
    if (label && seen.has(label)) errors[`portions.${p.index}.label`] ??= 'Gibt es schon'
    seen.add(label)
  }

  if (Object.keys(errors).length > 0 || !result.success) return { ok: false, errors }

  const v = result.data
  return {
    ok: true,
    data: {
      name: v.name,
      brand: v.brand === '' ? null : v.brand,
      barcode: v.barcode === '' ? null : v.barcode,
      unit: v.unit,
      per100: v.per100,
      isDrink: v.isDrink,
      portions: v.portions.map((p): Portion => ({ label: p.label, amount: p.amount })),
    },
  }
}

/** Nährwerte als Text fürs Formular (exakt, mit Komma) */
export function nutrientsToForm(per100: Nutrients): Record<NutrientKey, string> {
  const result = {} as Record<NutrientKey, string>
  for (const key of NUTRIENT_KEYS) result[key] = toInput(per100[key])
  return result
}

export type NutrientFormResult = { ok: true; per100: Nutrients } | { ok: false; errors: FormErrors }

const correctionSchema = z.object({
  kcal: z.number().max(MAX_KCAL, `Höchstens ${MAX_KCAL} kcal pro 100`).nullable(),
  fat: optionalGrams,
  satFat: optionalGrams,
  carbs: optionalGrams,
  sugar: optionalGrams,
  fiber: optionalGrams,
  protein: optionalGrams,
  salt: optionalGrams,
  water: optionalGrams,
})

/**
 * „Werte bearbeiten“ bei OFF und BLS (Korrekturschicht): jedes Feld darf leer sein (= unbekannt);
 * ob alle Pflichtangaben da sind, zählt erst beim Prüfen (logic/verify.ts).
 */
export function validateCorrectionForm(nutrients: Record<NutrientKey, string>): NutrientFormResult {
  const errors: FormErrors = {}
  const per100 = {} as Nutrients
  for (const key of NUTRIENT_KEYS) {
    const n = parseDecimal(nutrients[key])
    if (n === 'invalid') errors[key] = 'Keine gültige Zahl'
    per100[key] = n === 'invalid' ? null : n
  }
  const result = correctionSchema.safeParse(per100)
  if (!result.success) for (const issue of result.error.issues) errors[fieldKey(issue.path)] ??= issue.message
  const { fat, satFat, carbs, sugar } = per100
  if (fat !== null && satFat !== null && satFat > fat) errors.satFat ??= 'Mehr als Fett gesamt'
  if (carbs !== null && sugar !== null && sugar > carbs) errors.sugar ??= 'Mehr als Kohlenhydrate gesamt'
  return Object.keys(errors).length > 0 || !result.success ? { ok: false, errors } : { ok: true, per100: result.data }
}

export type PortionResult = { ok: true; portion: Portion } | { ok: false; errors: { label?: string; amount?: string } }

/** Eine Portion aus dem Portionen-Sheet prüfen; otherLabels = die übrigen Portionen */
export function validatePortion(input: PortionInput, otherLabels: readonly string[]): PortionResult {
  const errors: { label?: string; amount?: string } = {}
  const amount = parseDecimal(input.amount)
  if (amount === 'invalid') errors.amount = 'Keine gültige Zahl'

  const result = portionSchema.safeParse({ label: input.label, amount: amount === 'invalid' ? null : amount })
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0] as 'label' | 'amount'
      errors[key] ??= issue.message
    }
  }
  const label = input.label.trim().toLowerCase()
  if (label && otherLabels.some((l) => l.trim().toLowerCase() === label)) errors.label ??= 'Gibt es schon'

  if (errors.label || errors.amount || !result.success) return { ok: false, errors }
  return { ok: true, portion: result.data }
}

/** id des Eingabefelds, damit Fehler es fokussieren können */
export const fieldId = (key: string) => `f-${key}`
