import { describe, expect, it } from 'vitest'
import { newRecord, softDelete, unknownNutrients } from '../db/records.ts'
import type { FoodRef, Meal, Recipe } from '../db/types.ts'
import type { FoodChoice } from './addFood.ts'
import { buildMealRows, buildRecipeRows } from './groupList.ts'

const food = (ref: FoodRef, kcal: number | null): FoodChoice => ({
  ref,
  name: ref,
  source: 'BLS',
  verified: false,
  unit: 'g',
  per100: { ...unknownNutrients(), kcal },
  portions: [],
  archived: false,
})
const foods = new Map<FoodRef, FoodChoice>([
  ['bls:hafer', food('bls:hafer', 372)],
  ['bls:milch', food('bls:milch', 47)],
])
const meal = (name: string, archived = false) =>
  newRecord<Meal>({
    name,
    items: [
      { ref: 'bls:hafer', amount: 60, unit: 'g', portionLabel: null },
      { ref: 'bls:milch', amount: 250, unit: 'g', portionLabel: null },
    ],
    archived,
  })
const recipe = (name: string, finalWeightG: number) =>
  newRecord<Recipe>({
    name,
    ingredients: [{ ref: 'bls:hafer', amount: 100 }],
    finalWeightG,
    portions: [{ label: '1 Schale', amount: 250 }],
    archived: false,
  })

describe('buildMealRows', () => {
  it('Name, Anzahl Bestandteile, kcal der Vorlage; nach Name sortiert', () => {
    const rows = buildMealRows([meal('Quark-Bowl'), meal('Frühstück', true)], (ref) => foods.get(ref))
    expect(rows.map((r) => [r.name, r.meta, r.value, r.archived])).toEqual([
      ['Frühstück', '2 Bestandteile', '341 kcal', true],
      ['Quark-Bowl', '2 Bestandteile', '341 kcal', false],
    ])
  })

  it('unbekannter Wert → „mind.“', () => {
    const rows = buildMealRows([meal('X')], (ref) => (ref === 'bls:milch' ? food(ref, null) : foods.get(ref)))
    expect(rows[0]?.value).toBe('mind. 223 kcal')
  })

  it('gelöschte fehlen', () => {
    expect(buildMealRows([softDelete(meal('X'))], (ref) => foods.get(ref))).toEqual([])
  })
})

describe('buildRecipeRows', () => {
  it('Meta mit Endgewicht und Portion, kcal pro 100 g aus dem Resolver', () => {
    const r = recipe('Overnight Oats', 620)
    const per100 = food(`recipe:${r.id}`, 168)
    const rows = buildRecipeRows([r], (ref) => (ref === per100.ref ? per100 : undefined))
    expect(rows[0]).toMatchObject({
      name: 'Overnight Oats',
      meta: '620 g fertig · 1 Schale = 250 g',
      value: '168 kcal /100',
    })
  })

  it('nicht rechenbar → „–“', () => {
    expect(buildRecipeRows([recipe('X', 500)], () => undefined)[0]?.value).toBe('– kcal /100')
  })
})
