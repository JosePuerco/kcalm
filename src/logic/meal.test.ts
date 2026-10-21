import { describe, expect, it } from 'vitest'
import { newRecord, unknownNutrients } from '../db/records.ts'
import type { FoodRef, Meal, Nutrients } from '../db/types.ts'
import type { FoodChoice } from './addFood.ts'
import {
  amountFromKeypad,
  amountStep,
  initialMealLines,
  lineNutrients,
  mealAddLabel,
  mealEntries,
  mealTotals,
  scaledAmount,
  stepLineAmount,
  type MealLine,
} from './meal.ts'

const food = (ref: FoodRef, name: string, per100: Partial<Nutrients>, unit: 'g' | 'ml' = 'g'): FoodChoice => ({
  ref,
  name,
  source: 'BLS',
  verified: false,
  unit,
  per100: { ...unknownNutrients(), ...per100 },
  portions: [{ label: '1 Banane', amount: 120 }],
  archived: false,
})

// Beispiel aus Mahlzeit.dc.html
const hafer = food('bls:C130000', 'Haferflocken, zart', {
  kcal: 372,
  protein: 13.5,
  carbs: 58.7,
  fat: 7,
  fiber: 10,
})
const milch = food('product:milch', 'Milch 1,5 %', { kcal: 47, protein: 3.4, carbs: 4.8, fat: 1.5 }, 'ml')
const banane = food('bls:F503100', 'Banane', {
  kcal: 93,
  protein: 1.2,
  carbs: 20,
  fat: 0.2,
  fiber: 2,
})
const foods = new Map<FoodRef, FoodChoice>([hafer, milch, banane].map((f) => [f.ref, f]))

const meal = newRecord<Meal>({
  name: 'Frühstück-Klassiker',
  items: [
    { ref: hafer.ref, amount: 60, unit: 'g', portionLabel: null },
    { ref: milch.ref, amount: 250, unit: 'ml', portionLabel: null },
    { ref: banane.ref, amount: 120, unit: 'g', portionLabel: '1 Banane' },
  ],
  archived: false,
})

const lines = () => initialMealLines(meal, (ref) => foods.get(ref))
/** Startzeilen, eine davon geändert */
const linesWith = (i: number, patch: Partial<MealLine>) => lines().map((l, j) => (j === i ? { ...l, ...patch } : l))
const line = (amount: number): MealLine => ({
  ref: hafer.ref,
  food: hafer,
  on: true,
  amount,
})

describe('initialMealLines', () => {
  it('alle Bestandteile an, Mengen aus der Vorlage', () => {
    expect(lines().map((l) => [l.on, l.amount])).toEqual([
      [true, 60],
      [true, 250],
      [true, 120],
    ])
  })

  it('fehlendes Lebensmittel: Zeile bleibt sichtbar, aber aus', () => {
    const result = initialMealLines(meal, (ref) => (ref === milch.ref ? undefined : foods.get(ref)))
    expect(result[1]).toEqual({
      ref: milch.ref,
      food: null,
      on: false,
      amount: 250,
    })
  })
})

describe('Skalierung', () => {
  it('Menge × Skalierung', () => {
    expect(scaledAmount(line(60), 1.5)).toBe(90)
    expect(scaledAmount(line(60), 0.5)).toBe(30)
  })

  it('Nährwerte der Zeile skaliert: 60 g × 2 = 120 g Haferflocken → 446,4 kcal', () => {
    expect(lineNutrients(line(60), 2)?.kcal).toBeCloseTo(446.4, 10)
  })

  it('unbekannte Werte bleiben unbekannt', () => {
    expect(lineNutrients(line(60), 1)?.salt).toBeNull()
  })

  it('fehlendes Lebensmittel → keine Nährwerte', () => {
    expect(lineNutrients({ ref: milch.ref, food: null, on: false, amount: 250 }, 1)).toBeNull()
  })
})

describe('mealTotals', () => {
  it('Summe ×1: 223,2 + 117,5 + 111,6 = 452,3 kcal', () => {
    const t = mealTotals(lines(), 1)
    expect(t.nutrients.kcal.value).toBeCloseTo(452.3, 10)
    expect(t.active).toBe(3)
    expect(t.all).toBe(3)
  })

  it('Skalierung wirkt auf die Summe: ×0,5 halbiert', () => {
    expect(mealTotals(lines(), 0.5).nutrients.kcal.value).toBeCloseTo(226.15, 10)
  })

  it('abgewählte Bestandteile zählen nicht', () => {
    const t = mealTotals(linesWith(1, { on: false }), 1)
    expect(t.nutrients.kcal.value).toBeCloseTo(334.8, 10)
    expect(t.active).toBe(2)
    expect(t.all).toBe(3)
  })

  it('unbekannte Ballaststoffe bei Milch → „mind.“', () => {
    const fiber = mealTotals(lines(), 1).nutrients.fiber
    expect(fiber.value).toBeCloseTo(8.4, 10)
    expect(fiber.atLeast).toBe(true)
  })

  it('nichts angehakt → Summe 0, nicht „mind.“', () => {
    const t = mealTotals(
      lines().map((l) => ({ ...l, on: false })),
      1,
    )
    expect(t.nutrients.kcal).toEqual({ value: 0, atLeast: false })
    expect(t.active).toBe(0)
  })

  it('fehlendes Lebensmittel zählt nicht als aktiv, auch wenn on gesetzt wäre', () => {
    expect(mealTotals(linesWith(0, { food: null, on: true }), 1).active).toBe(2)
  })
})

describe('amountStep', () => {
  it('Schrittweiten wie im Prototyp', () => {
    expect(amountStep(30)).toBe(5) // Whey
    expect(amountStep(60)).toBe(10) // Haferflocken
    expect(amountStep(120)).toBe(10) // Banane
    expect(amountStep(250)).toBe(50) // Milch
  })

  it('Grenzen: 50 → 10, 200 → 50', () => {
    expect(amountStep(49.9)).toBe(5)
    expect(amountStep(50)).toBe(10)
    expect(amountStep(199.9)).toBe(10)
    expect(amountStep(200)).toBe(50)
  })
})

describe('stepLineAmount', () => {
  it('+ und − um eine Schrittweite', () => {
    expect(stepLineAmount(line(60), 1, 1)).toBe(70)
    expect(stepLineAmount(line(60), 1, -1)).toBe(50)
    expect(stepLineAmount(line(250), 1, 1)).toBe(300)
    expect(stepLineAmount(line(250), 1, -1)).toBe(200)
  })

  it('rastet auf Vielfache ein', () => {
    expect(stepLineAmount(line(87), 1, 1)).toBe(90)
    expect(stepLineAmount(line(87), 1, -1)).toBe(80)
    expect(stepLineAmount(line(12.5), 1, 1)).toBe(15)
    expect(stepLineAmount(line(12.5), 1, -1)).toBe(10)
  })

  it('− und + heben sich an den Grenzen auf', () => {
    expect(stepLineAmount(line(200), 1, -1)).toBe(190)
    expect(stepLineAmount(line(190), 1, 1)).toBe(200)
    expect(stepLineAmount(line(50), 1, -1)).toBe(45)
    expect(stepLineAmount(line(45), 1, 1)).toBe(50)
  })

  it('gerechnet auf der angezeigten Menge, zurückgegeben bei ×1', () => {
    // 60 g × 1,5 = 90 g angezeigt → + → 100 g angezeigt → 66,67 g bei ×1
    const next = stepLineAmount(line(60), 1.5, 1)
    expect(next).toBeCloseTo(100 / 1.5, 10)
    expect(scaledAmount(line(next), 1.5)).toBeCloseTo(100, 10)
  })

  it('− nicht unter 5', () => {
    expect(stepLineAmount(line(10), 1, -1)).toBe(5)
    expect(stepLineAmount(line(7), 1, -1)).toBe(5)
    expect(stepLineAmount(line(5), 1, -1)).toBe(5)
  })

  it('Menge unter 5 (z. B. 2 g Salz) bleibt bei −, + geht auf 5', () => {
    expect(stepLineAmount(line(2), 1, -1)).toBe(2)
    expect(stepLineAmount(line(2), 1, 1)).toBe(5)
  })

  it('Rundungsfehler beim Einrasten werden abgefangen', () => {
    // 0,7 × 100 = 70,00000000000001
    expect(stepLineAmount(line(0.7 * 100), 1, 1)).toBe(80)
    expect(stepLineAmount(line(0.7 * 100), 1, -1)).toBe(60)
  })
})

describe('amountFromKeypad', () => {
  it('angezeigte Menge zurück auf ×1', () => {
    expect(amountFromKeypad(75, 1.5)).toBe(50)
    expect(amountFromKeypad(75, 1)).toBe(75)
  })

  it('0, negativ und ungültig → Fehler', () => {
    expect(() => amountFromKeypad(0, 1)).toThrow(RangeError)
    expect(() => amountFromKeypad(-5, 1)).toThrow(RangeError)
    expect(() => amountFromKeypad(Number.NaN, 1)).toThrow(RangeError)
  })
})

describe('mealAddLabel', () => {
  it('Einzahl und Mehrzahl', () => {
    expect(mealAddLabel(3, 'Frühstück')).toBe('3 Einträge zu Frühstück hinzufügen')
    expect(mealAddLabel(1, 'Frühstück')).toBe('1 Eintrag zu Frühstück hinzufügen')
  })
})

describe('mealEntries', () => {
  it('ein Eintrag pro angehaktem Bestandteil, gruppiert, mit skalierten Mengen', () => {
    const entries = mealEntries(meal, linesWith(1, { on: false }), 1.5, '2026-10-21', 'slot-1', 'group-1')
    expect(entries).toHaveLength(2)
    expect(entries.map((e) => [e.nameSnapshot, e.amount, e.unit])).toEqual([
      ['Haferflocken, zart', 90, 'g'],
      ['Banane', 180, 'g'],
    ])
    expect(entries[0]?.nutrients.kcal).toBeCloseTo(334.8, 10)
    for (const e of entries) {
      expect(e.mealGroupId).toBe('group-1')
      expect(e.mealName).toBe('Frühstück-Klassiker')
      expect(e.date).toBe('2026-10-21')
      expect(e.slotId).toBe('slot-1')
      expect(e.kind).toBe('food')
    }
  })

  it('Portionsname nur, wenn die Menge genau passt', () => {
    expect(mealEntries(meal, lines(), 1, '2026-10-21', 's', 'g')[2]?.portionLabel).toBe('1 Banane')
    expect(mealEntries(meal, lines(), 2, '2026-10-21', 's', 'g')[2]?.portionLabel).toBeNull()
  })

  it('angepasste Mengen ändern die Vorlage nicht', () => {
    mealEntries(meal, linesWith(0, { amount: 80 }), 1, '2026-10-21', 's', 'g')
    expect(meal.items[0]?.amount).toBe(60)
  })

  it('fehlende Lebensmittel werden übersprungen', () => {
    expect(mealEntries(meal, linesWith(0, { food: null, on: true }), 1, '2026-10-21', 's', 'g')).toHaveLength(2)
  })

  it('nichts angehakt → Fehler', () => {
    expect(() =>
      mealEntries(
        meal,
        lines().map((l) => ({ ...l, on: false })),
        1,
        '2026-10-21',
        's',
        'g',
      ),
    ).toThrow(RangeError)
  })
})
