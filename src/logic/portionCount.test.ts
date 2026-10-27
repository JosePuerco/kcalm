import { describe, expect, it } from 'vitest'
import { unknownNutrients } from '../db/records.ts'
import type { FoodChoice } from './addFood.ts'
import {
  EMPTY_INPUT,
  gramsInput,
  inputAmount,
  inputFromEntry,
  inputPortionLabel,
  isActivePortion,
  keypadText,
  portionCountLabel,
  portionName,
  selectGrams,
  selectPortion,
  withText,
} from './portionCount.ts'

const waffel = { label: '1 Reiswaffel', amount: 6.8 }
const food: FoodChoice = {
  ref: 'product:x',
  name: 'Reiswaffeln',
  source: 'Eigenes Produkt',
  verified: true,
  unit: 'g',
  per100: { ...unknownNutrients(), kcal: 380 },
  portions: [waffel, { label: 'Portion', amount: 30 }],
  archived: false,
}

describe('portionName / portionCountLabel', () => {
  it('ohne führende „1 “', () => {
    expect(portionName(waffel)).toBe('Reiswaffel')
    expect(portionName({ label: 'Portion', amount: 30 })).toBe('Portion')
    expect(portionName({ label: '40 g', amount: 40 })).toBe('40 g')
    expect(portionName({ label: ' 1 Becher ', amount: 250 })).toBe('Becher')
  })

  it('Anzahl 1 behält das Etikett, sonst „4 × …“ mit Dezimalkomma', () => {
    expect(portionCountLabel(waffel, 1)).toBe('1 Reiswaffel')
    expect(portionCountLabel(waffel, 4)).toBe('4 × Reiswaffel')
    expect(portionCountLabel(waffel, 0.5)).toBe('0,5 × Reiswaffel')
    expect(portionCountLabel({ label: 'Portion', amount: 30 }, 2)).toBe('2 × Portion')
  })
})

describe('inputAmount', () => {
  it('leer → null', () => {
    expect(inputAmount(EMPTY_INPUT)).toBeNull()
    expect(inputAmount({ text: '', portion: waffel })).toBeNull()
  })

  it('in g/ml direkt, mit Portion Anzahl × Menge', () => {
    expect(inputAmount({ text: '12,5', portion: null })).toBe(12.5)
    expect(inputAmount({ text: '4', portion: waffel })).toBeCloseTo(27.2, 10)
    expect(inputAmount({ text: '0,5', portion: waffel })).toBeCloseTo(3.4, 10)
    expect(inputAmount({ text: '0', portion: waffel })).toBe(0)
  })
})

describe('inputPortionLabel', () => {
  it('mit Portion aus der Anzahl', () => {
    expect(inputPortionLabel(food, { text: '4', portion: waffel })).toBe('4 × Reiswaffel')
    expect(inputPortionLabel(food, { text: '1', portion: waffel })).toBe('1 Reiswaffel')
  })

  it('in g/ml nur bei genau einer Portion', () => {
    expect(inputPortionLabel(food, gramsInput(30))).toBe('Portion')
    expect(inputPortionLabel(food, gramsInput(31))).toBeNull()
    expect(inputPortionLabel(food, EMPTY_INPUT)).toBeNull()
  })
})

describe('selectPortion / selectGrams', () => {
  it('Chip startet mit Anzahl 1', () => {
    expect(selectPortion(waffel)).toEqual({ text: '1', portion: waffel, fresh: true })
  })

  it('vorbelegter Text: erste Taste ersetzt, danach wird angehängt', () => {
    const chosen = selectPortion(waffel)
    expect(keypadText(chosen)).toBe('')
    const typed = withText(chosen, '4')
    expect(typed).toEqual({ text: '4', portion: waffel })
    expect(keypadText(typed)).toBe('4')
    expect(keypadText(gramsInput(250))).toBe('250')
  })

  it('zurück zu g behält die Menge, eine Nachkommastelle', () => {
    expect(selectGrams({ text: '4', portion: waffel })).toEqual({ text: '27,2', portion: null, fresh: true })
    expect(selectGrams({ text: '3', portion: waffel })).toEqual({ text: '20,4', portion: null, fresh: true })
    expect(selectGrams({ text: '', portion: waffel })).toEqual(EMPTY_INPUT)
    const grams = gramsInput(50)
    expect(selectGrams(grams)).toBe(grams)
  })
})

describe('isActivePortion', () => {
  it('über Name und Menge', () => {
    expect(isActivePortion(selectPortion(waffel), waffel)).toBe(true)
    expect(isActivePortion(selectPortion(waffel), { label: 'Portion', amount: 30 })).toBe(false)
    expect(isActivePortion(gramsInput(6.8), waffel)).toBe(false)
    expect(isActivePortion(selectPortion({ label: '1 Reiswaffel', amount: 7 }), waffel)).toBe(false)
  })
})

describe('inputFromEntry', () => {
  it('„4 × Reiswaffel“ wird wieder Anzahl 4 und passt zum Chip', () => {
    const input = inputFromEntry(27.2, '4 × Reiswaffel')
    expect(input.text).toBe('4')
    expect(input.portion?.amount).toBeCloseTo(6.8, 10)
    expect(isActivePortion(input, waffel)).toBe(true)
    expect(inputPortionLabel(food, input)).toBe('4 × Reiswaffel')
    expect(inputPortionLabel(food, { ...input, text: '1' })).toBe('1 Reiswaffel')
  })

  it('Dezimal-Anzahl und „1 …“', () => {
    expect(inputFromEntry(3.4, '0,5 × Reiswaffel').text).toBe('0,5')
    expect(inputFromEntry(6.8, '1 Reiswaffel')).toEqual({ text: '1', portion: waffel })
    expect(keypadText(inputFromEntry(6.8, '1 Reiswaffel'))).toBe('1')
  })

  it('sonst Menge in g/ml', () => {
    expect(inputFromEntry(30, 'Portion')).toEqual({ text: '30', portion: null })
    expect(inputFromEntry(12.5, null)).toEqual({ text: '12,5', portion: null })
    expect(inputFromEntry(10, '0 × Reiswaffel')).toEqual({ text: '10', portion: null })
    expect(inputFromEntry(10, 'x × Reiswaffel')).toEqual({ text: '10', portion: null })
  })
})
