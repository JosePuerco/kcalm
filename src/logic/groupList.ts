// Zeilen der Lebensmittel-Liste, Reiter Mahlzeiten und Rezepte (Lebensmittel.dc.html): je eine Zeile pro Vorlage.

import type { FoodRef, Meal, Recipe } from '../db/types.ts'
import type { FoodChoice } from './addFood.ts'
import { formatSum } from './diary.ts'
import { formatNumber } from './format.ts'
import { mealKcal, partCount } from './meal.ts'
import { recipeMeta } from './recipe.ts'

export interface GroupRow {
  id: string
  name: string
  /** „4 Bestandteile“ bzw. „1.400 g fertig · 1 Teller = 450 g“ */
  meta: string
  /** rechts: „567 kcal“ bzw. „135 kcal /100“ */
  value: string
  archived: boolean
}

const byName = (a: GroupRow, b: GroupRow) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' })

/** Mahlzeiten mit Anzahl Bestandteile und kcal der Vorlage */
export function buildMealRows(meals: readonly Meal[], resolve: (ref: FoodRef) => FoodChoice | undefined): GroupRow[] {
  return meals
    .filter((m) => m.deletedAt === null)
    .map((m) => ({
      id: m.id,
      name: m.name,
      meta: partCount(m.items.length),
      value: `${formatSum(mealKcal(m, resolve))} kcal`,
      archived: m.archived,
    }))
    .sort(byName)
}

/** Rezepte mit Endgewicht, erster Portion und kcal pro 100 g („–“, solange nicht rechenbar) */
export function buildRecipeRows(
  recipes: readonly Recipe[],
  resolve: (ref: FoodRef) => FoodChoice | undefined,
): GroupRow[] {
  return recipes
    .filter((r) => r.deletedAt === null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      meta: recipeMeta(r),
      value: `${formatNumber(resolve(`recipe:${r.id}`)?.per100.kcal ?? null)} kcal /100`,
      archived: r.archived,
    }))
    .sort(byName)
}
