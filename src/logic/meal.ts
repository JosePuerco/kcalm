// Mahlzeit eintragen (Mahlzeit.dc.html): Bestandteile an/aus, Mengen mit −/+ oder Ziffernblock,
// Gesamtskalierung. Änderungen gelten nur für diesen Eintrag, die Vorlage bleibt gleich. Reine Funktionen.

import type { FoodRef, LocalDate, Meal, MealItem, Nutrients, Unit } from '../db/types.ts'
import { foodEntry, type FoodChoice, type NewEntryFields } from './addFood.ts'
import { nutrientsForAmount, sumNutrients, type NutrientSum } from './nutrients.ts'

export const MEAL_SCALES = [0.5, 1, 1.5, 2] as const
export type MealScale = (typeof MEAL_SCALES)[number]

/** Ein Bestandteil beim Eintragen */
export interface MealLine {
  ref: FoodRef
  /** null = Lebensmittel nicht mehr vorhanden; die Zeile ist dann aus und nicht wählbar */
  food: FoodChoice | null
  on: boolean
  /** Menge bei ×1; angezeigt und eingetragen wird Menge × Skalierung */
  amount: number
}

/** Startzustand: alle vorhandenen Bestandteile an, Mengen aus der Vorlage */
export function initialMealLines(meal: Meal, resolve: (ref: FoodRef) => FoodChoice | undefined): MealLine[] {
  return meal.items.map((item) => {
    const food = resolve(item.ref) ?? null
    return { ref: item.ref, food, on: food !== null, amount: item.amount }
  })
}

/** Angezeigte Menge: 60 g bei ×1,5 → 90 g */
export function scaledAmount(line: MealLine, scale: number): number {
  return line.amount * scale
}

/** Nährwerte eines Bestandteils bei der aktuellen Skalierung (auch für abgewählte Zeilen, zur Anzeige) */
export function lineNutrients(line: MealLine, scale: number): Nutrients | null {
  return line.food ? nutrientsForAmount(line.food.per100, scaledAmount(line, scale)) : null
}

/** Schrittweite für −/+: unter 50 → 5, unter 200 → 10, sonst 50 (60 g Haferflocken ±10, 250 ml Milch ±50) */
export function amountStep(amount: number): number {
  if (amount < 50) return 5
  if (amount < 200) return 10
  return 50
}

/** Kleinste Menge, die „−“ erreicht */
export const MIN_STEP_AMOUNT = 5

// Toleranz gegen Rundungsfehler beim Einrasten (z. B. 0,1 + 0,2)
const EPS = 1e-9

/**
 * Neue Menge bei ×1 nach Tipp auf −/+. Gerechnet wird auf der angezeigten Menge, die auf das nächste
 * Vielfache der Schrittweite einrastet (87 → „+“ → 90). „−“ nimmt die Schrittweite unterhalb der Menge,
 * damit − und + sich aufheben (200 → 190 → 200). „−“ geht nicht unter 5; liegt die Menge schon darunter,
 * bleibt sie.
 */
export function stepLineAmount(line: MealLine, scale: number, direction: 1 | -1): number {
  const shown = scaledAmount(line, scale)
  let next: number
  if (direction === 1) {
    const step = amountStep(shown)
    next = (Math.floor(shown / step + EPS) + 1) * step
  } else {
    if (shown <= MIN_STEP_AMOUNT + EPS) return line.amount
    const step = amountStep(shown - EPS)
    next = Math.max(MIN_STEP_AMOUNT, (Math.ceil(shown / step - EPS) - 1) * step)
  }
  return next / scale
}

/** Menge aus dem Ziffernblock (angezeigte Menge) zurück auf ×1: 75 g bei ×1,5 → 50 g */
export function amountFromKeypad(shown: number, scale: number): number {
  if (!Number.isFinite(shown) || shown <= 0) throw new RangeError(`Ungültige Menge: ${shown}`)
  return shown / scale
}

export interface MealTotals {
  nutrients: Record<keyof Nutrients, NutrientSum>
  /** Angehakte Bestandteile */
  active: number
  all: number
}

/** Summe über die angehakten Bestandteile; unbekannte Werte machen sie zu „mind.“ */
export function mealTotals(lines: readonly MealLine[], scale: number): MealTotals {
  const active = lines.filter((l) => l.on && l.food !== null)
  return {
    nutrients: sumNutrients(active.map((l) => lineNutrients(l, scale) as Nutrients)),
    active: active.length,
    all: lines.length,
  }
}

/** Knopf: „3 Einträge zu Frühstück hinzufügen“ */
export function mealAddLabel(active: number, slotName: string): string {
  return `${active} ${active === 1 ? 'Eintrag' : 'Einträge'} zu ${slotName} hinzufügen`
}

/**
 * Ein Tagebucheintrag pro angehaktem Bestandteil, über mealGroupId gruppiert. Jeder Eintrag speichert
 * seine absoluten Nährwerte (Snapshot); spätere Änderungen an Vorlage oder Produkten ändern ihn nie.
 */
export function mealEntries(
  meal: Meal,
  lines: readonly MealLine[],
  scale: number,
  date: LocalDate,
  slotId: string,
  mealGroupId: string,
): NewEntryFields[] {
  const entries = lines
    .filter((l) => l.on && l.food !== null)
    .map((l) => ({
      ...foodEntry(l.food as FoodChoice, scaledAmount(l, scale), date, slotId),
      mealGroupId,
      mealName: meal.name,
    }))
  if (entries.length === 0) throw new RangeError('Mindestens ein Bestandteil muss angehakt sein')
  return entries
}

// ── Vorlage anlegen und bearbeiten ──

export type MealFormData = Pick<Meal, 'name' | 'items'>
export type MealFormResult = { ok: true; data: MealFormData } | { ok: false; error: string }

/** Längster Name, wie beim Schnelleintrag */
export const NAME_MAX = 120

/** Name Pflicht, mindestens ein Bestandteil, Mengen über 0. Rezepte als Bestandteil sind erlaubt. */
export function validateMeal(values: MealFormData): MealFormResult {
  const name = values.name.trim()
  if (name === '') return { ok: false, error: 'Bitte einen Namen eingeben' }
  if (name.length > NAME_MAX) return { ok: false, error: `Name: höchstens ${NAME_MAX} Zeichen` }
  if (values.items.length === 0) return { ok: false, error: 'Mindestens einen Bestandteil hinzufügen' }
  if (values.items.some((i) => !Number.isFinite(i.amount) || i.amount <= 0)) {
    return { ok: false, error: 'Jeder Bestandteil braucht eine Menge über 0' }
  }
  return { ok: true, data: { name, items: values.items } }
}

/** kcal der Vorlage bei ×1; fehlende Lebensmittel oder unbekannte Werte → „mind.“, gar nichts auflösbar → unbekannt */
export function mealKcal(meal: Pick<Meal, 'items'>, resolve: (ref: FoodRef) => FoodChoice | undefined): NutrientSum {
  const lines = meal.items.map((item) => ({
    ref: item.ref,
    food: resolve(item.ref) ?? null,
    on: true,
    amount: item.amount,
  }))
  // Nichts auflösbar → unbekannt, nicht 0
  if (lines.every((l) => l.food === null)) return { value: null, atLeast: false }
  const sum = mealTotals(lines, 1).nutrients.kcal
  const missing = lines.some((l) => l.food === null)
  return missing && sum.value !== null ? { value: sum.value, atLeast: true } : sum
}

/** „4 Bestandteile“ / „1 Bestandteil“ */
export function partCount(n: number): string {
  return `${n} ${n === 1 ? 'Bestandteil' : 'Bestandteile'}`
}

/**
 * Neue Einheit eines Lebensmittels in den Bestandteilen (Jan, 27.10.2026): nur die Bezeichnung, die Menge
 * bleibt. null = nichts zu ändern.
 */
export function relabelMealItems(items: readonly MealItem[], ref: FoodRef, unit: Unit): MealItem[] | null {
  if (!items.some((i) => i.ref === ref && i.unit !== unit)) return null
  return items.map((i) => (i.ref === ref ? { ...i, unit } : i))
}
