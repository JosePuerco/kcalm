// Rezepte (Rezept.dc.html): Zutaten roh + Endgewicht nach dem Kochen → Nährwerte pro 100 g fertig.
// Gerechnet wird immer aus den aktuellen Zutaten, gespeichert wird nichts davon. Reine Funktionen.

import { NUTRIENT_KEYS } from '../db/records.ts'
import type { FoodRef, Nutrients, Recipe, RecipeIngredient } from '../db/types.ts'
import type { FoodChoice } from './addFood.ts'
import { formatAmount } from './format.ts'
import { NAME_MAX } from './meal.ts'
import { nutrientsForAmount, sumNutrients, type NutrientSum } from './nutrients.ts'

/** Eine Zutat mit dem aufgelösten Lebensmittel */
export interface RecipeLine {
  ingredient: RecipeIngredient
  food: FoodChoice
}

/** Summe der Rohmengen; ml zählt wie g (1 ml ≈ 1 g) */
export function rawWeight(lines: readonly Pick<RecipeLine, 'ingredient'>[]): number {
  return lines.reduce((sum, l) => sum + l.ingredient.amount, 0)
}

/** Nährwerte des ganzen Topfs: Summe der Zutaten, unbekannte Werte machen sie zu „mind.“ */
export function recipeTotals(lines: readonly RecipeLine[]): Record<keyof Nutrients, NutrientSum> {
  return sumNutrients(lines.map((l) => nutrientsForAmount(l.food.per100, l.ingredient.amount)))
}

/**
 * Nährwerte pro 100 g fertig: Summe der Zutaten ÷ Endgewicht × 100.
 * Beispiel: Chili 1.890 kcal, Endgewicht 1.400 g → 135 kcal/100 g.
 * Ist ein Wert bei einer Zutat unbekannt, ist er pro 100 g unbekannt (null): Ein Tagebucheintrag kann
 * kein „mind.“ speichern, und eine zu kleine Zahl darf nicht als genau gelten.
 * null, wenn noch nicht rechenbar (keine Zutaten oder kein gültiges Endgewicht).
 */
export function recipePer100(lines: readonly RecipeLine[], finalWeightG: number): Nutrients | null {
  if (lines.length === 0 || !Number.isFinite(finalWeightG) || finalWeightG <= 0) return null
  const totals = recipeTotals(lines)
  const result = {} as Nutrients
  for (const key of NUTRIENT_KEYS) {
    const { value, atLeast } = totals[key]
    result[key] = value === null || atLeast ? null : (value / finalWeightG) * 100
  }
  return result
}

export type CookingLossState = 'normal' | 'high' | 'gain'

export interface CookingLoss {
  /** Exakt, positiv = verdampft; negativ = Endgewicht über roh */
  percent: number
  state: CookingLossState
}

/** Ab hier Warnung (PLAN.md 2, Rezepte) */
export const HIGH_LOSS_PERCENT = 40

/**
 * Kochverlust = (1 − Endgewicht ÷ Rohgewicht) × 100. „high“ über 40 % (gerundete Anzeige, damit nie
 * „40 %“ als Warnung erscheint), „gain“ bei Endgewicht über roh. null, wenn nicht rechenbar.
 */
export function cookingLoss(rawG: number, finalWeightG: number): CookingLoss | null {
  if (!(rawG > 0) || !Number.isFinite(rawG) || !(finalWeightG > 0) || !Number.isFinite(finalWeightG)) return null
  const percent = (1 - finalWeightG / rawG) * 100
  const state: CookingLossState =
    finalWeightG > rawG ? 'gain' : Math.round(percent) > HIGH_LOSS_PERCENT ? 'high' : 'normal'
  return { percent, state }
}

/** „13 % Wasser beim Kochen verdampft“ bzw. Hinweis bei Endgewicht über roh */
export function cookingLossText(loss: CookingLoss): string {
  if (loss.state === 'gain') return 'Endgewicht höher als roh: Wasser dazugegeben?'
  // +0 statt −0
  return `${Math.round(loss.percent) + 0} % Wasser beim Kochen verdampft`
}

/** Schrittweite Endgewicht (−/+) und zugleich kleinster Wert für „−“ */
export const FINAL_WEIGHT_STEP = 50

/** Endgewicht nach −/+: rastet auf Vielfache von 50 g ein (1.387 → „+“ → 1.400), nicht unter 50 g */
export function stepFinalWeight(weight: number, direction: 1 | -1): number {
  const s = FINAL_WEIGHT_STEP
  if (direction === 1) return (Math.floor(weight / s + 1e-9) + 1) * s
  if (weight <= s) return weight
  return Math.max(s, (Math.ceil(weight / s - 1e-9) - 1) * s)
}

/**
 * −/+ am Endgewicht. Ist es noch leer, geht es vom Rohgewicht aus los (1.615 g → „−“ → 1.600 g);
 * ohne Zutaten startet „+“ bei 50 g, „−“ lässt es leer.
 */
export function nextFinalWeight(current: number | null, rawG: number, direction: 1 | -1): number | null {
  if (current !== null) return stepFinalWeight(current, direction)
  if (rawG > 0) return stepFinalWeight(rawG, direction)
  return direction === 1 ? FINAL_WEIGHT_STEP : null
}

/**
 * Rezept als Lebensmittel für Suche und Mengen-Schritt: pro 100 g aus den aktuellen Zutaten, Eintrag durch
 * Abwiegen der Portion. Der Eintrag speichert seine Werte als Snapshot, spätere Rezeptänderungen gelten nur
 * für künftige Einträge. null, wenn eine Zutat fehlt oder das Rezept nicht rechenbar ist.
 */
export function choiceFromRecipe(recipe: Recipe, resolve: (ref: FoodRef) => FoodChoice | undefined): FoodChoice | null {
  const lines: RecipeLine[] = []
  for (const ingredient of recipe.ingredients) {
    const food = resolve(ingredient.ref)
    if (!food) return null
    lines.push({ ingredient, food })
  }
  const per100 = recipePer100(lines, recipe.finalWeightG)
  if (!per100) return null
  return {
    ref: `recipe:${recipe.id}`,
    name: recipe.name,
    source: 'Rezept',
    verified: false,
    unit: 'g',
    per100,
    portions: recipe.portions,
    archived: recipe.archived,
  }
}

// ── Rezept anlegen und bearbeiten ──

export type RecipeFormData = Pick<Recipe, 'name' | 'ingredients' | 'finalWeightG' | 'portions'>
export type RecipeFormValues = Omit<RecipeFormData, 'finalWeightG'> & {
  /** null = noch nicht eingegeben */
  finalWeightG: number | null
}
export type RecipeFormResult = { ok: true; data: RecipeFormData } | { ok: false; error: string }

/** Name Pflicht, mindestens eine Zutat (kein Rezept), Mengen und Endgewicht über 0 */
export function validateRecipe(values: RecipeFormValues): RecipeFormResult {
  const name = values.name.trim()
  if (name === '') return { ok: false, error: 'Bitte einen Namen eingeben' }
  if (name.length > NAME_MAX) return { ok: false, error: `Name: höchstens ${NAME_MAX} Zeichen` }
  if (values.ingredients.length === 0) return { ok: false, error: 'Mindestens eine Zutat hinzufügen' }
  // Kein Rezept im Rezept: sonst wären Kreisbezüge möglich
  if (values.ingredients.some((i) => i.ref.startsWith('recipe:'))) {
    return { ok: false, error: 'Ein Rezept kann keine Zutat sein' }
  }
  if (values.ingredients.some((i) => !Number.isFinite(i.amount) || i.amount <= 0)) {
    return { ok: false, error: 'Jede Zutat braucht eine Menge über 0' }
  }
  const final = values.finalWeightG
  if (final === null || !Number.isFinite(final) || final <= 0) {
    return { ok: false, error: 'Bitte das Endgewicht eingeben' }
  }
  return { ok: true, data: { name, ingredients: values.ingredients, finalWeightG: final, portions: values.portions } }
}

/** Zeile in der Lebensmittel-Liste: „1.400 g fertig · 1 Teller = 450 g“ */
export function recipeMeta(recipe: Pick<Recipe, 'finalWeightG' | 'portions'>): string {
  const parts = [`${formatAmount(recipe.finalWeightG)} g fertig`]
  const first = recipe.portions[0]
  if (first) {
    const amount = `${formatAmount(first.amount)} g`
    // Ist das Etikett schon die Menge („450 g“), nicht doppelt
    parts.push(first.label.trim() === amount ? amount : `${first.label} = ${amount}`)
  }
  return parts.join(' · ')
}
