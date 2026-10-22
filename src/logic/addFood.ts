// Hinzufügen-Sheet (Kern.dc.html): Lebensmittel zur Auswahl aufbereiten, „Zuletzt gegessen“, Mengen-Schritt
// und der neue Tagebucheintrag mit Nährwert-Snapshot. Reine Funktionen.

import { NUTRIENT_KEYS } from '../db/records.ts'
import type {
  BlsPref,
  Entry,
  FoodRef,
  LocalDate,
  Nutrients,
  Portion,
  Product,
  ProductOverride,
  Unit,
} from '../db/types.ts'
import type { BlsFood } from './blsFoods.ts'
import { SOURCE_LABEL } from './foodList.ts'
import { formatAmount, formatNumber } from './format.ts'
import { nutrientsForAmount } from './nutrients.ts'
import { effectiveNutrients, isVerified } from './verify.ts'

/** Ein Lebensmittel, wie es Suche und Mengen-Schritt brauchen */
export interface FoodChoice {
  ref: FoodRef
  name: string
  /** „Open Food Facts“, „Eigenes Produkt“, „BLS“ */
  source: string
  verified: boolean
  unit: Unit
  /** Werte, die für neue Einträge gelten (mit Korrekturschicht, falls gewählt) */
  per100: Nutrients
  portions: Portion[]
  archived: boolean
}

export function choiceFromProduct(p: Product, override?: ProductOverride): FoodChoice {
  return {
    ref: `product:${p.id}`,
    name: p.name,
    source: SOURCE_LABEL[p.source],
    verified: isVerified(p.source, override),
    unit: p.unit,
    per100: effectiveNutrients(p.per100, override, p.useOverride),
    portions: p.portions,
    archived: p.archived,
  }
}

export function choiceFromBls(food: BlsFood, pref?: BlsPref, override?: ProductOverride): FoodChoice {
  const activePref = pref && pref.deletedAt === null ? pref : undefined
  return {
    ref: `bls:${food.code}`,
    name: food.name,
    source: SOURCE_LABEL.bls,
    verified: isVerified('bls', override),
    // BLS-Werte gelten pro 100 g essbaren Anteil
    unit: 'g',
    per100: effectiveNutrients(food.per100, override, activePref?.useOverride ?? true),
    portions: activePref?.portions ?? [],
    archived: false,
  }
}

/** „Zuletzt gegessen“: Lebensmittel der jüngsten Einträge, jedes einmal, neueste zuerst */
export function recentRefs(entries: readonly Entry[], limit = 15): FoodRef[] {
  const sorted = entries
    .filter((e) => e.deletedAt === null && e.kind === 'food' && e.ref !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const refs: FoodRef[] = []
  for (const e of sorted) {
    if (refs.length >= limit) break
    if (!refs.includes(e.ref as FoodRef)) refs.push(e.ref as FoodRef)
  }
  return refs
}

/** Startmenge im Mengen-Schritt: erste Portion (wie im Prototyp), sonst 100 */
export function initialAmount(food: FoodChoice): number {
  return food.portions[0]?.amount ?? 100
}

/** Zahl für den Ziffernblock: 250 → „250“, 12.5 → „12,5“ */
export function amountToKeypad(amount: number): string {
  return String(amount).replace('.', ',')
}

/** Portions-Chip: „1 Becher · 250 g“; ist das Etikett schon die Menge („40 g“), nur das */
export function portionChipLabel(portion: Portion, unit: Unit): string {
  const amount = `${formatAmount(portion.amount)} ${unit}`
  return portion.label.trim() === amount ? amount : `${portion.label} · ${amount}`
}

/** Portionsname für den Eintrag, wenn die Menge genau einer Portion entspricht */
export function portionLabelFor(food: FoodChoice, amount: number): string | null {
  return food.portions.find((p) => p.amount === amount)?.label ?? null
}

/** „372 kcal/100 g“ */
export function per100Label(food: FoodChoice): string {
  return `${formatNumber(food.per100.kcal)} kcal/100 ${food.unit}`
}

export type NewEntryFields = Omit<Entry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>

/** Neuer Tagebucheintrag; speichert die absoluten Nährwerte als Snapshot (spätere Produktänderungen ändern ihn nie) */
export function foodEntry(food: FoodChoice, amount: number, date: LocalDate, slotId: string): NewEntryFields {
  if (!Number.isFinite(amount) || amount <= 0) throw new RangeError(`Ungültige Menge: ${amount}`)
  return {
    date,
    slotId,
    kind: 'food',
    ref: food.ref,
    nameSnapshot: food.name,
    amount,
    unit: food.unit,
    portionLabel: portionLabelFor(food, amount),
    nutrients: nutrientsForAmount(food.per100, amount),
    mealGroupId: null,
    mealName: null,
  }
}

/** Toast nach dem Hinzufügen: „Skyr natur · 158 kcal zu Snacks“ */
export function addedMessage(name: string, kcal: number | null, slotName: string): string {
  return `${name} · ${formatNumber(kcal)} kcal zu ${slotName}`
}

/** Lässt sich der Eintrag über den Mengen-Schritt bearbeiten? (Lebensmittel mit Verweis und Menge) */
export function canEditAsFood(entry: Entry): boolean {
  return entry.kind === 'food' && entry.ref !== null && entry.unit !== null && entry.amount !== null && entry.amount > 0
}

/**
 * Lebensmittel zum Bearbeiten eines Eintrags. Die Werte pro 100 kommen aus dem Snapshot des Eintrags
 * (Snapshot ÷ Menge × 100), nicht aus dem aktuellen Produkt: Eine spätere Produktänderung darf alte Tage
 * auch beim Ändern der Menge nicht verändern. Portionen und Quelle vom aktuellen Lebensmittel, falls vorhanden.
 */
export function choiceFromEntry(entry: Entry, current?: FoodChoice): FoodChoice {
  if (!canEditAsFood(entry) || entry.ref === null || entry.amount === null || entry.unit === null) {
    throw new RangeError('Nur Lebensmittel-Einträge mit Menge lassen sich so bearbeiten')
  }
  const per100 = {} as Nutrients
  for (const key of NUTRIENT_KEYS) {
    const v = entry.nutrients[key]
    per100[key] = v === null ? null : (v / entry.amount) * 100
  }
  return {
    ref: entry.ref,
    name: entry.nameSnapshot,
    source: current?.source ?? '',
    verified: current?.verified ?? false,
    unit: entry.unit,
    per100,
    portions: current?.portions ?? [],
    archived: current?.archived ?? false,
  }
}

export type EntryChanges = Pick<Entry, 'date' | 'slotId' | 'amount' | 'portionLabel' | 'nutrients'>

/** Änderungen beim Speichern: Menge (Werte skaliert), Slot und Tag (Verschieben) */
export function editedEntry(food: FoodChoice, amount: number, date: LocalDate, slotId: string): EntryChanges {
  const { nutrients, portionLabel } = foodEntry(food, amount, date, slotId)
  return { date, slotId, amount, portionLabel, nutrients }
}

/**
 * Prüf-Dialog vor dem Mengen-Schritt (Scan und Auswahl aus der Suche): nur ungeprüfte OFF-Produkte.
 * Eigene Produkte gelten als geprüft, BLS und Rezepte fragen nicht (Jan, 21.10.2026).
 */
export function needsCheck(food: FoodChoice): boolean {
  return food.ref.startsWith('product:') && food.source === SOURCE_LABEL.off && !food.verified
}
