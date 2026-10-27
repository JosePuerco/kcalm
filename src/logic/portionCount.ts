// Mehrere Portionen im Mengen-Schritt (Phase 12b): Tipp auf einen Portions-Chip schaltet den Ziffernblock
// auf Anzahl um („4 × Reiswaffel“ = 27,2 g). Gespeichert wird weiter die Menge in g/ml plus portionLabel.
// Reine Funktionen.

import type { Portion } from '../db/types.ts'
import { amountToKeypad, portionLabelFor, type FoodChoice } from './addFood.ts'
import { parseKeypadValue } from './keypad.ts'

/** Eingabe im Mengen-Schritt: ohne Portion ist text die Menge in g/ml, mit Portion die Anzahl */
export interface AmountInput {
  text: string
  portion: Portion | null
}

export const EMPTY_INPUT: AmountInput = { text: '', portion: null }

/** Eingabe in g/ml, z. B. beim Bearbeiten: 250 → „250“ */
export function gramsInput(amount: number): AmountInput {
  return { text: amountToKeypad(amount), portion: null }
}

/** Portionsname ohne führende „1 “: „1 Reiswaffel“ → „Reiswaffel“, „Portion“ bleibt */
export function portionName(portion: Portion): string {
  const label = portion.label.trim()
  return label.startsWith('1 ') ? label.slice(2).trim() : label
}

/** Etikett für den Eintrag: Anzahl 1 → Portionsname wie angelegt, sonst „4 × Reiswaffel“, „0,5 × Portion“ */
export function portionCountLabel(portion: Portion, count: number): string {
  if (count === 1) return portion.label
  return `${amountToKeypad(count)} × ${portionName(portion)}`
}

/** Menge in g/ml (intern exakt, nicht gerundet); leere Eingabe → null */
export function inputAmount(input: AmountInput): number | null {
  const value = parseKeypadValue(input.text)
  if (value === null) return null
  return input.portion ? value * input.portion.amount : value
}

/** portionLabel für den Eintrag: mit Portion aus der Anzahl, sonst wie bisher bei genau einer Portion */
export function inputPortionLabel(food: FoodChoice, input: AmountInput): string | null {
  const amount = inputAmount(input)
  if (amount === null) return null
  if (input.portion) return portionCountLabel(input.portion, parseKeypadValue(input.text) as number)
  return portionLabelFor(food, amount)
}

/** Tipp auf einen Portions-Chip: Anzahl 1 dieser Portion */
export function selectPortion(portion: Portion): AmountInput {
  return { text: '1', portion }
}

/** Chip „g“: zurück zur Menge in g/ml, die bisherige Menge bleibt (auf eine Nachkommastelle für den Ziffernblock) */
export function selectGrams(input: AmountInput): AmountInput {
  if (!input.portion) return input
  const amount = inputAmount(input)
  return amount === null ? EMPTY_INPUT : gramsInput(Math.round(amount * 10) / 10)
}

/** Ist dieser Chip gerade aktiv? Vergleich über Name und Menge (beim Bearbeiten ist die Portion nachgebaut) */
export function isActivePortion(input: AmountInput, portion: Portion): boolean {
  return (
    input.portion !== null &&
    portionName(input.portion) === portionName(portion) &&
    Math.abs(input.portion.amount - portion.amount) < 1e-9
  )
}

/**
 * Eingabe beim Bearbeiten eines Eintrags: „4 × Reiswaffel“ bei 27,2 g wird wieder Anzahl 4 einer
 * Portion à 6,8 g, „1 Reiswaffel“ Anzahl 1. Sonst (kein oder fremdes Etikett) die Menge in g/ml.
 */
export function inputFromEntry(amount: number, portionLabel: string | null): AmountInput {
  const label = portionLabel?.trim() ?? ''
  const multi = /^(\d+(?:,\d+)?) × (.+)$/.exec(label)
  const single = /^1 (.+)$/.exec(label)
  const count = multi ? parseKeypadValue(multi[1] as string) : single ? 1 : null
  // „4 × Reiswaffel“ → Portion „1 Reiswaffel“, damit Anzahl 1 beim Speichern wieder so heißt
  const name = multi ? `1 ${multi[2] as string}` : single ? label : null
  if (count === null || count <= 0 || name === null || !(amount > 0)) return gramsInput(amount)
  return { text: amountToKeypad(count), portion: { label: name, amount: amount / count } }
}
