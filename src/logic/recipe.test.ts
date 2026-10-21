import { describe, expect, it } from 'vitest'
import { newRecord, unknownNutrients } from '../db/records.ts'
import type { FoodRef, Nutrients, Recipe } from '../db/types.ts'
import type { FoodChoice } from './addFood.ts'
import { formatNumber } from './format.ts'
import { nutrientsForAmount } from './nutrients.ts'
import {
  choiceFromRecipe,
  cookingLoss,
  cookingLossText,
  rawWeight,
  recipeMeta,
  recipePer100,
  recipeTotals,
  stepFinalWeight,
  validateRecipe,
  type RecipeFormValues,
  type RecipeLine,
} from './recipe.ts'

const full = {
  kcal: 0,
  fat: 0,
  satFat: 0,
  carbs: 0,
  sugar: 0,
  fiber: 0,
  protein: 0,
  salt: 0,
  water: null,
}

const food = (ref: FoodRef, per100: Partial<Nutrients>, unit: 'g' | 'ml' = 'g'): FoodChoice => ({
  ref,
  name: ref,
  source: 'BLS',
  verified: false,
  unit,
  per100: { ...unknownNutrients(), ...full, ...per100 },
  portions: [],
  archived: false,
})

const line = (f: FoodChoice, amount: number): RecipeLine => ({
  ingredient: { ref: f.ref, amount },
  food: f,
})

// Chili aus Rezept.dc.html
const chili: RecipeLine[] = [
  line(food('bls:hack', { kcal: 254, protein: 17.2, fat: 20 }), 500),
  line(food('bls:bohnen', { kcal: 100, protein: 7, carbs: 13, fat: 0.5 }), 250),
  line(food('bls:tomaten', { kcal: 26, protein: 1.3, carbs: 4.3, fat: 0.2 }), 500),
  line(food('bls:paprika', { kcal: 31, protein: 1, carbs: 6, fat: 0.3 }), 200),
  line(food('bls:zwiebel', { kcal: 30, protein: 1.2, carbs: 5.8, fat: 0.2 }), 150),
  line(food('bls:oel', { kcal: 884, fat: 100 }), 15),
]

describe('rawWeight', () => {
  it('Summe der Rohmengen', () => {
    expect(rawWeight(chili)).toBe(1615)
  })

  it('ml zählt wie g', () => {
    expect(rawWeight([line(food('product:bruehe', {}, 'ml'), 500), line(food('bls:reis', {}), 200)])).toBe(700)
  })

  it('keine Zutaten → 0', () => {
    expect(rawWeight([])).toBe(0)
  })
})

describe('recipeTotals', () => {
  it('Chili: 1.889,6 kcal im Topf', () => {
    expect(recipeTotals(chili).kcal.value).toBeCloseTo(1889.6, 10)
  })
})

describe('recipePer100', () => {
  it('Beispiel aus PLAN.md: 1.890 kcal, Endgewicht 1.400 g → 135 kcal/100 g; 450 g → 608 kcal', () => {
    const lines = [line(food('bls:a', { kcal: 100 }), 1000), line(food('bls:b', { kcal: 890 }), 100)]
    const per100 = recipePer100(lines, 1400)
    expect(per100?.kcal).toBeCloseTo(135, 10)
    const plate = nutrientsForAmount(per100 as Nutrients, 450).kcal
    expect(plate).toBeCloseTo(607.5, 10)
    expect(formatNumber(plate)).toBe('608')
  })

  it('Chili exakt: 134,97 kcal/100 g, 450 g → 607 kcal (ohne Zwischenrundung)', () => {
    const per100 = recipePer100(chili, 1400) as Nutrients
    expect(per100.kcal).toBeCloseTo(1889.6 / 14, 10)
    expect(formatNumber(per100.kcal)).toBe('135')
    expect(formatNumber(nutrientsForAmount(per100, 450).kcal)).toBe('607')
  })

  it('Makros pro 100 g: Eiweiß 141,25 g ÷ 1.400 g × 100', () => {
    const per100 = recipePer100(chili, 1400) as Nutrients
    expect(per100.protein).toBeCloseTo((86 + 17.5 + 6.5 + 2 + 1.8) / 14, 10)
  })

  it('Kochverlust erhöht die Dichte: weniger Endgewicht → mehr pro 100 g', () => {
    const viel = recipePer100(chili, 1615) as Nutrients
    const wenig = recipePer100(chili, 800) as Nutrients
    expect(wenig.kcal as number).toBeGreaterThan(viel.kcal as number)
    // Endgewicht = roh → pro 100 g wie der Durchschnitt der Zutaten
    expect(viel.kcal).toBeCloseTo((1889.6 / 1615) * 100, 10)
  })

  it('unbekannt bei einer Zutat → pro 100 g unbekannt (null), nie 0', () => {
    const lines = [
      line(food('bls:a', { kcal: 100, fiber: 3 }), 100),
      line(food('bls:b', { kcal: 100, fiber: null }), 100),
    ]
    const per100 = recipePer100(lines, 200) as Nutrients
    expect(per100.fiber).toBeNull()
    expect(per100.kcal).toBe(100)
  })

  it('bei allen Zutaten unbekannt → null', () => {
    expect((recipePer100(chili, 1400) as Nutrients).water).toBeNull()
  })

  it('bekannte 0 bleibt 0', () => {
    expect(recipePer100([line(food('bls:oel', { kcal: 884, fat: 100 }), 10)], 10)?.carbs).toBe(0)
  })

  it('nicht rechenbar → null', () => {
    expect(recipePer100([], 1400)).toBeNull()
    expect(recipePer100(chili, 0)).toBeNull()
    expect(recipePer100(chili, -100)).toBeNull()
    expect(recipePer100(chili, Number.NaN)).toBeNull()
    expect(recipePer100(chili, Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('cookingLoss', () => {
  it('Chili: 1.615 g roh, 1.400 g fertig → 13 % verdampft', () => {
    const loss = cookingLoss(1615, 1400)
    expect(loss?.percent).toBeCloseTo((1 - 1400 / 1615) * 100, 10)
    expect(loss?.state).toBe('normal')
    expect(cookingLossText(loss!)).toBe('13 % Wasser beim Kochen verdampft')
  })

  it('über 40 % → Warnung', () => {
    expect(cookingLoss(1000, 590)?.state).toBe('high')
  })

  it('genau 40 % und 40,4 % (Anzeige „40 %“) → noch keine Warnung', () => {
    expect(cookingLoss(1000, 600)?.state).toBe('normal')
    expect(cookingLoss(1000, 596)?.state).toBe('normal')
    expect(cookingLoss(1000, 595)?.state).toBe('high')
  })

  it('Endgewicht gleich roh → 0 %', () => {
    const loss = cookingLoss(1000, 1000)
    expect(loss?.state).toBe('normal')
    expect(cookingLossText(loss!)).toBe('0 % Wasser beim Kochen verdampft')
  })

  it('Endgewicht über roh → Hinweis (z. B. Reis, Nudeln)', () => {
    const loss = cookingLoss(300, 750)
    expect(loss?.state).toBe('gain')
    expect(loss?.percent).toBe(-150)
    expect(cookingLossText(loss!)).toBe('Endgewicht höher als roh: Wasser dazugegeben?')
  })

  it('knapp über roh: Hinweis, nicht „0 % verdampft“', () => {
    expect(cookingLoss(1000, 1000.4)?.state).toBe('gain')
  })

  it('nicht rechenbar → null', () => {
    expect(cookingLoss(0, 500)).toBeNull()
    expect(cookingLoss(1000, 0)).toBeNull()
    expect(cookingLoss(Number.NaN, 500)).toBeNull()
    expect(cookingLoss(1000, Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('stepFinalWeight', () => {
  it('±50 g', () => {
    expect(stepFinalWeight(1400, 1)).toBe(1450)
    expect(stepFinalWeight(1400, -1)).toBe(1350)
  })

  it('rastet auf Vielfache von 50 ein', () => {
    expect(stepFinalWeight(1387, 1)).toBe(1400)
    expect(stepFinalWeight(1387, -1)).toBe(1350)
  })

  it('nicht unter 50 g; darunter bleibt es', () => {
    expect(stepFinalWeight(100, -1)).toBe(50)
    expect(stepFinalWeight(80, -1)).toBe(50)
    expect(stepFinalWeight(50, -1)).toBe(50)
    expect(stepFinalWeight(30, -1)).toBe(30)
    expect(stepFinalWeight(30, 1)).toBe(50)
  })

  it('ohne Endgewicht (0) → + geht auf 50', () => {
    expect(stepFinalWeight(0, 1)).toBe(50)
  })
})

describe('choiceFromRecipe', () => {
  const recipe = newRecord<Recipe>({
    name: 'Chili con Carne',
    ingredients: chili.map((l) => l.ingredient),
    finalWeightG: 1400,
    portions: [{ label: '1 Teller', amount: 450 }],
    archived: false,
  })
  const foods = new Map(chili.map((l) => [l.food.ref, l.food]))

  it('Rezept als Lebensmittel pro 100 g mit Portionen', () => {
    const choice = choiceFromRecipe(recipe, (ref) => foods.get(ref))
    expect(choice).toMatchObject({
      ref: `recipe:${recipe.id}`,
      name: 'Chili con Carne',
      source: 'Rezept',
      unit: 'g',
      portions: [{ label: '1 Teller', amount: 450 }],
      archived: false,
    })
    expect(choice?.per100.kcal).toBeCloseTo(1889.6 / 14, 10)
  })

  it('fehlende Zutat → null', () => {
    expect(choiceFromRecipe(recipe, (ref) => (ref === 'bls:oel' ? undefined : foods.get(ref)))).toBeNull()
  })

  it('kein gültiges Endgewicht → null', () => {
    expect(choiceFromRecipe({ ...recipe, finalWeightG: 0 }, (ref) => foods.get(ref))).toBeNull()
  })
})

describe('validateRecipe', () => {
  const values: RecipeFormValues = {
    name: ' Chili con Carne ',
    ingredients: chili.map((l) => l.ingredient),
    finalWeightG: 1400,
    portions: [{ label: '1 Teller', amount: 450 }],
  }

  it('gültig: Name wird getrimmt', () => {
    const r = validateRecipe(values)
    expect(r.ok && r.data.name).toBe('Chili con Carne')
    expect(r.ok && r.data.finalWeightG).toBe(1400)
  })

  it('Name fehlt', () => {
    expect(validateRecipe({ ...values, name: '' })).toEqual({ ok: false, error: 'Bitte einen Namen eingeben' })
  })

  it('ohne Zutaten', () => {
    expect(validateRecipe({ ...values, ingredients: [] })).toEqual({
      ok: false,
      error: 'Mindestens eine Zutat hinzufügen',
    })
  })

  it('Rezept als Zutat ist nicht erlaubt', () => {
    const r = validateRecipe({ ...values, ingredients: [{ ref: 'recipe:x', amount: 100 }] })
    expect(r).toEqual({ ok: false, error: 'Ein Rezept kann keine Zutat sein' })
  })

  it('Zutatmenge 0 oder ungültig', () => {
    expect(validateRecipe({ ...values, ingredients: [{ ref: 'bls:a', amount: 0 }] }).ok).toBe(false)
    expect(validateRecipe({ ...values, ingredients: [{ ref: 'bls:a', amount: Number.NaN }] }).ok).toBe(false)
  })

  it('Endgewicht fehlt, 0 oder ungültig', () => {
    for (const finalWeightG of [null, 0, -5, Number.NaN]) {
      expect(validateRecipe({ ...values, finalWeightG })).toEqual({ ok: false, error: 'Bitte das Endgewicht eingeben' })
    }
  })

  it('Endgewicht über roh ist erlaubt (nur Hinweis)', () => {
    expect(validateRecipe({ ...values, finalWeightG: 3000 }).ok).toBe(true)
  })
})

describe('recipeMeta', () => {
  it('Endgewicht und erste Portion', () => {
    expect(recipeMeta({ finalWeightG: 1400, portions: [{ label: '1 Teller', amount: 450 }] })).toBe(
      '1.400 g fertig · 1 Teller = 450 g',
    )
  })

  it('ohne Portion', () => {
    expect(recipeMeta({ finalWeightG: 620, portions: [] })).toBe('620 g fertig')
  })

  it('Etikett ist schon die Menge → nicht doppelt', () => {
    expect(recipeMeta({ finalWeightG: 620, portions: [{ label: '200 g', amount: 200 }] })).toBe('620 g fertig · 200 g')
  })
})
