// Kostenauswertung (Phase 13). Reine Funktionen; gerundet wird erst in der Anzeige.
// Kosten sind ein abgeleiteter Wert aus dem aktuellen Preis, auch für alte Einträge: bewusste Ausnahme
// vom Snapshot-Prinzip (PLAN.md 7 „Kosten: …“). Nur der Schnelleintrag speichert seinen Preis (entries.cost).
// Unbekannt = null, nie 0; Summen mit unbekannten Teilen zeigen „mind.“.

import type { BlsPref, Entry, FoodRef, LocalDate, Price, Product, Recipe, Unit } from '../db/types.ts'
import { formatNumber } from './format.ts'
import type { NutrientSum } from './nutrients.ts'
import { parseDecimal } from './productForm.ts'
import {
  averageSums,
  barScale,
  dayBars,
  dayState,
  statsDates,
  weekBars,
  type BarMetric,
  type DayState,
  type StatsBar,
  type StatsRange,
} from './stats.ts'

/** Summe von Kosten in €, gleiche Regeln wie bei Nährwerten */
export type CostSum = NutrientSum

// ---------- Preis und Kosten ----------

/** € je g bzw. ml: 1,49 € für 500 g → 0,00298. null bei fehlendem oder ungültigem Preis. */
export function unitPrice(price: Price | null): number | null {
  if (price === null) return null
  const { amount, per } = price
  if (!Number.isFinite(amount) || !Number.isFinite(per) || amount < 0 || per <= 0) return null
  return amount / per
}

/** Kosten für eine Menge in g bzw. ml; unbekannt bleibt unbekannt */
export function costForAmount(perUnit: number | null, amount: number | null): number | null {
  if (perUnit === null || amount === null || !Number.isFinite(amount) || amount < 0) return null
  return perUnit * amount
}

/** Summe; unbekannte Kosten zählen nicht als 0, sondern machen sie zu „mind.“. Leere Liste = bekannt 0. */
export function sumCosts(values: readonly (number | null)[]): CostSum {
  let value: number | null = values.length === 0 ? 0 : null
  let unknown = 0
  for (const v of values) {
    if (v === null) unknown++
    else value = (value ?? 0) + v
  }
  return { value, atLeast: value !== null && unknown > 0 }
}

/** € je g bzw. ml eines Lebensmittels; null = unbekannt */
export type UnitPriceLookup = (ref: FoodRef) => number | null

type RecipeLike = Pick<Recipe, 'ingredients' | 'finalWeightG'>

/**
 * Kosten mehrerer Zutaten (Rezept-Topf) bzw. Bestandteile (Mahlzeit): Summe, „mind.“ wenn einer
 * keinen Preis hat
 */
export function itemsCost(items: readonly { ref: FoodRef; amount: number }[], lookup: UnitPriceLookup): CostSum {
  return sumCosts(items.map((i) => costForAmount(lookup(i.ref), i.amount)))
}

/** Zutaten bzw. Bestandteile ohne bekannten Preis, jeder Verweis einmal (für „Preis fehlt bei: …“) */
export function missingPrices(items: readonly { ref: FoodRef }[], lookup: UnitPriceLookup): FoodRef[] {
  return [...new Set(items.map((i) => i.ref))].filter((ref) => lookup(ref) === null)
}

/**
 * € je g fertig = Topfkosten ÷ Endgewicht. Fehlt bei einer Zutat der Preis, ist der Rezeptpreis unbekannt
 * (wie bei den Nährwerten pro 100 g: eine zu kleine Zahl darf nicht als genau gelten).
 */
export function recipeUnitPrice(recipe: RecipeLike, lookup: UnitPriceLookup): number | null {
  if (recipe.ingredients.length === 0 || !(recipe.finalWeightG > 0)) return null
  const total = itemsCost(recipe.ingredients, lookup)
  return total.value === null || total.atLeast ? null : total.value / recipe.finalWeightG
}

export interface PriceSources {
  products: readonly Pick<Product, 'id' | 'price' | 'deletedAt'>[]
  blsPrefs: readonly Pick<BlsPref, 'blsCode' | 'price' | 'deletedAt'>[]
  recipes: readonly (Pick<Recipe, 'id' | 'deletedAt'> & RecipeLike)[]
}

/** Preis je g/ml für Produkte, BLS und Rezepte aus den aktuellen Preisen. Gelöschte zählen nicht. */
export function priceLookup(sources: PriceSources): UnitPriceLookup {
  const products = new Map(sources.products.filter((p) => p.deletedAt === null).map((p) => [p.id, p.price]))
  const bls = new Map(sources.blsPrefs.filter((b) => b.deletedAt === null).map((b) => [b.blsCode, b.price]))
  const recipes = new Map(sources.recipes.filter((r) => r.deletedAt === null).map((r) => [r.id, r]))
  const recipePrices = new Map<string, number | null>()

  const lookup = (ref: FoodRef, inRecipe = false): number | null => {
    const sep = ref.indexOf(':')
    const kind = ref.slice(0, sep)
    const id = ref.slice(sep + 1)
    if (kind === 'product') return unitPrice(products.get(id) ?? null)
    if (kind === 'bls') return unitPrice(bls.get(id) ?? null)
    // Rezepte enthalten keine Rezepte; falls doch, gilt die Zutat als unbekannt (keine Endlosschleife)
    if (kind !== 'recipe' || inRecipe) return null
    if (!recipePrices.has(id)) {
      const recipe = recipes.get(id)
      recipePrices.set(id, recipe ? recipeUnitPrice(recipe, (r) => lookup(r, true)) : null)
    }
    return recipePrices.get(id) ?? null
  }
  return (ref) => lookup(ref)
}

/** Kosten eines Eintrags: Schnelleintrag = gespeicherter Preis, sonst aktueller Preis × Menge */
export function entryCost(entry: Pick<Entry, 'kind' | 'ref' | 'amount' | 'cost'>, lookup: UnitPriceLookup): number | null {
  if (entry.kind === 'quick') return entry.cost
  return entry.ref === null ? null : costForAmount(lookup(entry.ref), entry.amount)
}

// ---------- Anzeige und Eingabe ----------

/** 1.49 → „1,49 €“; unbekannt → „–“ */
export function formatEuro(value: number | null): string {
  const text = formatNumber(value, 2)
  return value === null || !Number.isFinite(value) ? text : `${text} €`
}

/** „12,40 €“ bzw. „mind. 12,40 €“ */
export function costText(sum: CostSum): string {
  return `${sum.atLeast ? 'mind. ' : ''}${formatEuro(sum.value)}`
}

/** Grundpreis wie auf dem Regalschild: 1,49 € für 500 g → „2,98 €/kg“, bei ml „€/l“ */
export function basePriceText(price: Price | null, unit: Unit): string | null {
  const perUnit = unitPrice(price)
  if (perUnit === null) return null
  return `${formatEuro(perUnit * 1000)}/${unit === 'g' ? 'kg' : 'l'}`
}

/** Obergrenzen gegen Tippfehler (z. B. 1490 statt 14,90) */
export const MAX_PRICE_EUR = 1000
export const MAX_PACKAGE = 100_000
export const MAX_QUICK_COST_EUR = 1000

export interface PriceInput {
  amount: string
  per: string
}

export type PriceResult = { ok: true; price: Price | null } | { ok: false; errors: { amount?: string; per?: string } }

/** Beide Felder leer = kein Preis; sonst beide Pflicht. Betrag ab 0 € (z. B. geschenkt), Packung über 0. */
export function validatePrice(input: PriceInput): PriceResult {
  const amount = parseDecimal(input.amount)
  const per = parseDecimal(input.per)
  if (amount === null && per === null) return { ok: true, price: null }

  const errors: { amount?: string; per?: string } = {}
  if (amount === 'invalid') errors.amount = 'Keine gültige Zahl'
  else if (amount === null) errors.amount = 'Preis fehlt'
  else if (amount > MAX_PRICE_EUR) errors.amount = `Höchstens ${formatNumber(MAX_PRICE_EUR)} €`

  if (per === 'invalid') errors.per = 'Keine gültige Zahl'
  else if (per === null) errors.per = 'Packungsgröße fehlt'
  else if (per <= 0) errors.per = 'Muss größer als 0 sein'
  else if (per > MAX_PACKAGE) errors.per = `Höchstens ${formatNumber(MAX_PACKAGE)}`

  if (errors.amount || errors.per || typeof amount !== 'number' || typeof per !== 'number') return { ok: false, errors }
  return { ok: true, price: { amount, per } }
}

/** Optionaler Preis beim Schnelleintrag: leer = unbekannt (null) */
export function validateQuickCost(text: string): { ok: true; cost: number | null } | { ok: false; error: string } {
  const v = parseDecimal(text)
  if (v === 'invalid') return { ok: false, error: 'Keine gültige Zahl' }
  if (v !== null && v > MAX_QUICK_COST_EUR) return { ok: false, error: `Höchstens ${formatNumber(MAX_QUICK_COST_EUR)} €` }
  return { ok: true, cost: v }
}

// ---------- Statistik ----------

export interface CostDay {
  date: LocalDate
  state: DayState
  cost: CostSum
}

type CostEntry = Pick<Entry, 'date' | 'kind' | 'ref' | 'amount' | 'cost' | 'nameSnapshot' | 'nutrients'>

export interface CostStatsInput {
  today: LocalDate
  /** nicht gelöschte Einträge; andere Tage werden ignoriert */
  entries: readonly CostEntry[]
  completeDates: ReadonlySet<LocalDate>
  lookup: UnitPriceLookup
}

/** Kosten je Tag mit demselben Zustand wie in der kcal-Statistik */
export function costDays(input: CostStatsInput & { dates: readonly LocalDate[] }): CostDay[] {
  const byDate = new Map<LocalDate, (number | null)[]>()
  for (const e of input.entries) {
    const cost = entryCost(e, input.lookup)
    const list = byDate.get(e.date)
    if (list) list.push(cost)
    else byDate.set(e.date, [cost])
  }
  return input.dates.map((date) => {
    const costs = byDate.get(date) ?? []
    return { date, state: dayState(date, input.today, costs.length > 0, input.completeDates), cost: sumCosts(costs) }
  })
}

export interface CostTiles {
  /** Ø € der vollständigen Tage; null = keine vollständigen Tage */
  avgPerDay: CostSum | null
  /** Summe aller Tage mit Einträgen bis heute */
  total: CostSum
}

/** Summe mehrerer Summen; „mind.“, sobald eine davon unvollständig oder unbekannt ist */
export function addSums(sums: readonly CostSum[]): CostSum {
  const total = sumCosts(sums.map((s) => s.value))
  return { value: total.value, atLeast: total.atLeast || (total.value !== null && sums.some((s) => s.atLeast)) }
}

export function costTiles(days: readonly CostDay[]): CostTiles {
  const complete = days.filter((d) => d.state === 'complete')
  const tracked = days.filter((d) => d.state === 'complete' || d.state === 'incomplete')
  return { avgPerDay: averageSums(complete.map((d) => d.cost)), total: addSums(tracked.map((d) => d.cost)) }
}

const COST_METRIC: BarMetric<CostDay> = { value: (d) => d.cost, text: costText }

export interface ValueRatios {
  /** € je 1.000 kcal; null = keine Einträge mit Preis und kcal */
  perThousandKcal: number | null
  /** € je 100 g Eiweiß; null = keine Einträge mit Preis und Eiweiß */
  perHundredProtein: number | null
}

/** Preis-Leistung nur aus Einträgen, bei denen Preis und Nährwert bekannt sind (sonst verzerrt) */
export function valueRatios(entries: readonly CostEntry[], lookup: UnitPriceLookup): ValueRatios {
  let costKcal = 0
  let kcal = 0
  let costProtein = 0
  let protein = 0
  for (const e of entries) {
    const cost = entryCost(e, lookup)
    if (cost === null) continue
    if (e.nutrients.kcal !== null) {
      costKcal += cost
      kcal += e.nutrients.kcal
    }
    if (e.nutrients.protein !== null) {
      costProtein += cost
      protein += e.nutrients.protein
    }
  }
  return {
    perThousandKcal: kcal > 0 ? (costKcal / kcal) * 1000 : null,
    perHundredProtein: protein > 0 ? (costProtein / protein) * 100 : null,
  }
}

export const TOP_FOODS = 5
export const QUICK_GROUP_NAME = 'Schnelleinträge'

export interface TopFood {
  /** FoodRef bzw. „quick“ für alle Schnelleinträge */
  key: string
  name: string
  cost: number
  /** Anteil an den bekannten Kosten des Zeitraums, 0–1 */
  share: number
  entries: number
}

/** Teuerste Lebensmittel nach Summe der bekannten Kosten; Schnelleinträge zusammen als eine Zeile */
export function topFoods(entries: readonly CostEntry[], lookup: UnitPriceLookup, limit = TOP_FOODS): TopFood[] {
  const groups = new Map<string, { name: string; latest: LocalDate; cost: number; entries: number }>()
  let total = 0
  for (const e of entries) {
    const cost = entryCost(e, lookup)
    if (cost === null) continue
    total += cost
    const key = e.kind === 'quick' || e.ref === null ? 'quick' : e.ref
    const name = key === 'quick' ? QUICK_GROUP_NAME : e.nameSnapshot
    const group = groups.get(key)
    if (!group) groups.set(key, { name, latest: e.date, cost, entries: 1 })
    else {
      group.cost += cost
      group.entries++
      // Name aus dem jüngsten Eintrag (Produkt kann umbenannt worden sein)
      if (e.date >= group.latest) {
        group.latest = e.date
        group.name = name
      }
    }
  }
  return [...groups.entries()]
    .map(([key, g]) => ({ key, name: g.name, cost: g.cost, share: total > 0 ? g.cost / total : 0, entries: g.entries }))
    .filter((f) => f.cost > 0)
    .sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name, 'de'))
    .slice(0, limit)
}

export interface CostStats {
  tiles: CostTiles
  bars: StatsBar[]
  scale: number
  ratios: ValueRatios
  top: TopFood[]
  /** Einträge im Zeitraum (bis heute) ohne bekannten Preis */
  withoutPrice: number
}

/** Alles für den Abschnitt „Kosten“ im Statistik-Screen; gleiche Zeiträume wie die kcal-Statistik */
export function buildCostStats(range: StatsRange, input: CostStatsInput): CostStats {
  const dates = statsDates(input.today, range)
  const days = costDays({ ...input, dates })
  const first = dates[0] as LocalDate
  const inRange = input.entries.filter((e) => e.date >= first && e.date <= input.today)
  const bars = range === 'quarter' ? weekBars(days, input.today, COST_METRIC) : dayBars(days, input.today, COST_METRIC)
  return {
    tiles: costTiles(days),
    bars,
    scale: barScale(bars, null),
    ratios: valueRatios(inRange, input.lookup),
    top: topFoods(inRange, input.lookup),
    withoutPrice: inRange.filter((e) => entryCost(e, input.lookup) === null).length,
  }
}
