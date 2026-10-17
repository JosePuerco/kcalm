import { describe, expect, it } from 'vitest'
import { NUTRIENT_KEYS, unknownNutrients } from '../db/records.ts'
import type { Nutrients } from '../db/types.ts'
import { formatNumber } from './format.ts'
import { nutrientsForAmount, valueForAmount } from './nutrients.ts'

// Haferflocken pro 100 g, Ballaststoffe und Alkohol hier bewusst unbekannt
const oats: Nutrients = {
  kcal: 372,
  fat: 7,
  satFat: 1.3,
  carbs: 58.7,
  sugar: 0.7,
  fiber: null,
  protein: 13.5,
  salt: 0.02,
  water: 10,
  alcohol: null,
}

describe('valueForAmount', () => {
  it('rechnet Wert pro 100 × Menge ÷ 100', () => {
    expect(valueForAmount(372, 60)).toBe(223.2)
    expect(valueForAmount(372, 100)).toBe(372)
    expect(valueForAmount(372, 250)).toBe(930)
  })

  it('lässt unbekannt unbekannt, auch bei Menge 0', () => {
    expect(valueForAmount(null, 60)).toBeNull()
    expect(valueForAmount(null, 0)).toBeNull()
  })

  it('bekannte 0 bleibt 0', () => {
    expect(valueForAmount(0, 60)).toBe(0)
  })
})

describe('nutrientsForAmount', () => {
  it('Beispiel aus PLAN.md: 60 g Haferflocken → 223,2 kcal, Anzeige 223', () => {
    const n = nutrientsForAmount(oats, 60)
    expect(n.kcal).toBe(223.2)
    expect(formatNumber(n.kcal)).toBe('223')
  })

  it('rechnet alle bekannten Werte und rundet intern nicht', () => {
    const n = nutrientsForAmount(oats, 60)
    expect(n.fat).toBeCloseTo(4.2, 10)
    expect(n.satFat).toBeCloseTo(0.78, 10)
    expect(n.carbs).toBeCloseTo(35.22, 10)
    expect(n.protein).toBeCloseTo(8.1, 10)
    expect(n.salt).toBeCloseTo(0.012, 10)
    expect(n.water).toBe(6)
  })

  it('unbekannte Werte bleiben null, nie 0', () => {
    const n = nutrientsForAmount(oats, 60)
    expect(n.fiber).toBeNull()
    expect(n.alcohol).toBeNull()
  })

  it('alles unbekannt bleibt alles unbekannt', () => {
    const n = nutrientsForAmount(unknownNutrients(), 150)
    for (const key of NUTRIENT_KEYS) expect(n[key]).toBeNull()
  })

  it('liefert alle zehn Nährwerte', () => {
    expect(Object.keys(nutrientsForAmount(oats, 60)).sort()).toEqual([...NUTRIENT_KEYS].sort())
  })

  it('Menge 0: bekannte Werte 0, unbekannte null', () => {
    const n = nutrientsForAmount(oats, 0)
    expect(n.kcal).toBe(0)
    expect(n.fiber).toBeNull()
  })

  it('kleine Mengen mit Dezimalkomma (0,5 g)', () => {
    expect(nutrientsForAmount(oats, 0.5).kcal).toBeCloseTo(1.86, 10)
  })

  it('große Mengen (Getränk 1.500 ml)', () => {
    const cola: Nutrients = { ...unknownNutrients(), kcal: 42, sugar: 10.6 }
    const n = nutrientsForAmount(cola, 1500)
    expect(n.kcal).toBe(630)
    expect(n.sugar).toBeCloseTo(159, 10)
  })

  it('kein sichtbarer Rundungsfehler über viele krumme Mengen', () => {
    for (let amount = 0; amount <= 1000; amount += 0.5) {
      const kcal = nutrientsForAmount(oats, amount).kcal!
      expect(Math.abs(kcal - (372 * amount) / 100)).toBeLessThan(1e-9)
    }
  })

  it('verändert das Produkt nicht (Snapshot bleibt unabhängig)', () => {
    const copy = { ...oats }
    const n = nutrientsForAmount(oats, 60)
    n.kcal = 0
    expect(oats).toEqual(copy)
  })

  it('lehnt negative, unendliche und ungültige Mengen ab', () => {
    expect(() => nutrientsForAmount(oats, -1)).toThrow(RangeError)
    expect(() => nutrientsForAmount(oats, Number.NaN)).toThrow('Ungültige Menge')
    expect(() => nutrientsForAmount(oats, Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})
