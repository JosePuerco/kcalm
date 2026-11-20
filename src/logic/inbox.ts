// Vorschläge aus Fitboard (PLAN.md Phase 16): Briefkasten prüfen, nach Tag und Gruppe ordnen, Verweise
// auflösen, Schätzungen umrechnen und daraus Tagebucheinträge bauen. Reine Funktionen.
// Unbekannte Nährwerte bleiben null, nie 0. Nichts landet ohne Jans Tipp im Tagebuch.

import { z } from 'zod'
import { NUTRIENT_KEYS, unknownNutrients } from '../db/records.ts'
import type { FoodRef, InboxItem, LocalDate, Meal, Nutrients, Slot, Unit } from '../db/types.ts'
import { ESTIMATE_REF, ESTIMATE_SOURCE, foodEntry, type FoodChoice, type NewEntryFields } from './addFood.ts'

export { ESTIMATE_SOURCE }
import { addDays } from './dates.ts'
import { initialMealLines, mealEntries, type MealLine } from './meal.ts'
import { nutrientsForAmount } from './nutrients.ts'
import { normalize, search, type SearchIndex } from './search.ts'

/** Vorschläge bis so viele Tage zurück; ältere verfallen (wie im Briefkasten) */
export const SUGGESTION_PAST_DAYS = 7

const grams = (max: number) => z.number().min(0).max(max).nullable()

/** Gleiches Format wie entrySuggestionSchema in kcalm-server/src/inbox.ts */
const entrySuggestionSchema = z
  .object({
    slot: z.string().trim().min(1).max(40).nullable(),
    group: z.object({ id: z.uuid(), name: z.string().trim().min(1).max(60) }).nullable(),
    ref: z.object({ type: z.enum(['product', 'meal', 'recipe']), id: z.string().min(1).max(100) }).nullable(),
    name: z.string().trim().min(1).max(80),
    amount: z.number().gt(0).max(10_000).nullable(),
    unit: z.string().trim().min(1).max(10).nullable(),
    kcal: z.number().min(0).max(10_000).nullable(),
    protein: grams(1000),
    carbs: grams(1000),
    sugar: grams(1000),
    fat: grams(1000),
    satFat: grams(1000),
    fiber: grams(1000),
    salt: grams(100),
  })
  .refine((s) => s.ref !== null || s.kcal !== null)

export type EntrySuggestion = z.infer<typeof entrySuggestionSchema>

/** Ein geprüfter Vorschlag fürs Tagebuch */
export interface Suggestion extends InboxItem {
  kind: 'entry'
  payload: EntrySuggestion
}

const itemSchema = z.object({
  id: z.uuid(),
  kind: z.literal('entry'),
  date: z.iso.date(),
  payload: entrySuggestionSchema,
  createdAt: z.iso.datetime(),
})

/** Prüft jeden Vorschlag einzeln; ungültige oder unbekannte Arten fallen weg, der Rest bleibt */
export function parseInboxItems(items: readonly unknown[]): Suggestion[] {
  return items.flatMap((raw) => {
    const r = itemSchema.safeParse(raw)
    return r.success ? [r.data] : []
  })
}

/** Antwort von GET /v1/inbox */
export function parseInbox(json: unknown): Suggestion[] {
  const items = (json as { ok?: unknown; items?: unknown } | null)?.items
  if ((json as { ok?: unknown } | null)?.ok !== true || !Array.isArray(items)) return []
  return parseInboxItems(items)
}

/** Ohne bereits entschiedene und ohne zu alte */
export function visibleSuggestions(items: readonly Suggestion[], decided: ReadonlySet<string>, today: LocalDate): Suggestion[] {
  const from = addDays(today, -SUGGESTION_PAST_DAYS)
  return items.filter((s) => !decided.has(s.id) && s.date >= from)
}

export interface SuggestionGroup {
  /** Gruppen-id, beim Einzelvorschlag die id des Vorschlags */
  id: string
  /** null = Einzelvorschlag */
  name: string | null
  items: Suggestion[]
}

/** Vorschläge eines Tages, je Foto bzw. Nachricht eine Gruppe; älteste zuerst */
export function suggestionsForDay(items: readonly Suggestion[], date: LocalDate): SuggestionGroup[] {
  const groups = new Map<string, SuggestionGroup>()
  const sorted = items.filter((s) => s.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  for (const s of sorted) {
    const g = s.payload.group
    const key = g?.id ?? s.id
    const existing = groups.get(key)
    if (existing) existing.items.push(s)
    else groups.set(key, { id: key, name: g?.name ?? null, items: [s] })
  }
  return [...groups.values()]
}

const isUnit = (u: string | null): u is Unit => u === 'g' || u === 'ml'

/** Nährwerte des Vorschlags als absolute Werte (unbekannt = null) */
function suggestionNutrients(s: EntrySuggestion): Nutrients {
  const n = unknownNutrients()
  for (const key of NUTRIENT_KEYS) n[key] = s[key]
  return n
}

/** Werte pro 100 g bzw. ml, nur bei Menge in g oder ml; sonst nicht umrechenbar */
export function estimatePer100(s: EntrySuggestion): Nutrients | null {
  if (s.amount === null || s.amount <= 0 || !isUnit(s.unit)) return null
  const per100 = unknownNutrients()
  for (const key of NUTRIENT_KEYS) {
    const v = s[key]
    per100[key] = v === null ? null : (v / s.amount) * 100
  }
  return per100
}

export type ResolvedPart =
  | { kind: 'food'; food: FoodChoice; amount: number }
  | { kind: 'meal'; meal: Meal; lines: MealLine[]; scale: number }
  | { kind: 'estimate'; name: string; amount: number | null; unit: Unit | null; nutrients: Nutrients; per100: Nutrients | null }
  | { kind: 'missing' }

function estimateOf(s: EntrySuggestion): ResolvedPart {
  if (s.kcal === null) return { kind: 'missing' }
  const per100 = estimatePer100(s)
  return {
    kind: 'estimate',
    name: s.name,
    amount: per100 ? s.amount : null,
    unit: per100 && isUnit(s.unit) ? s.unit : null,
    nutrients: suggestionNutrients(s),
    per100,
  }
}

/**
 * Verweis auflösen: Kcalm rechnet mit seinen aktuellen Werten (Korrekturen eingeschlossen). Kennt Kcalm den
 * Verweis nicht (gelöscht, archiviert), gelten die mitgeschickten freien Werte; ohne solche → missing.
 */
export function resolvePart(
  s: EntrySuggestion,
  resolve: (ref: FoodRef) => FoodChoice | undefined,
  findMeal: (id: string) => Meal | undefined,
): ResolvedPart {
  const ref = s.ref
  if (ref && (ref.type === 'product' || ref.type === 'recipe')) {
    const food = resolve(`${ref.type}:${ref.id}`)
    if (food && !food.archived) {
      // Menge nur übernehmen, wenn die Einheit passt; sonst erste Portion bzw. 100
      const fits = s.amount !== null && (s.unit === null || s.unit === food.unit)
      const amount = fits ? (s.amount as number) : (food.portions[0]?.amount ?? 100)
      return { kind: 'food', food, amount }
    }
  }
  if (ref && ref.type === 'meal') {
    const meal = findMeal(ref.id)
    if (meal && meal.deletedAt === null && !meal.archived) {
      const lines = initialMealLines(meal, resolve)
      if (lines.some((l) => l.on)) {
        const scale = s.amount !== null && s.unit === null ? s.amount : 1
        return { kind: 'meal', meal, lines, scale }
      }
    }
  }
  return estimateOf(s)
}

/** Schätzung mit g/ml als Lebensmittel für den Mengen-Schritt (nur Anzeige, wird nie gespeichert); sonst null */
export function estimateFood(part: Extract<ResolvedPart, { kind: 'estimate' }>): FoodChoice | null {
  if (!part.per100 || part.unit === null) return null
  return {
    ref: ESTIMATE_REF,
    name: part.name,
    source: ESTIMATE_SOURCE,
    verified: false,
    unit: part.unit,
    per100: part.per100,
    portions: [],
    archived: false,
  }
}

/** Menge einer Schätzung ändern: Werte linear umrechnen, unbekannt bleibt unbekannt */
export function scaleEstimate(part: Extract<ResolvedPart, { kind: 'estimate' }>, amount: number): Extract<ResolvedPart, { kind: 'estimate' }> {
  if (!part.per100) return part
  return { ...part, amount, nutrients: nutrientsForAmount(part.per100, amount) }
}

/** Slot nach Namen (ohne Groß/Klein); archiviert, umbenannt oder unbekannt → null, Jan wählt */
export function slotIdFor(name: string | null, slots: readonly Slot[]): string | null {
  if (name === null) return null
  const wanted = name.toLocaleLowerCase('de')
  return slots.find((s) => s.deletedAt === null && !s.archived && s.name.toLocaleLowerCase('de') === wanted)?.id ?? null
}

export interface PartChoice {
  part: ResolvedPart
  slotId: string
}

/**
 * Einträge zu übernommenen Teilen. Gruppe → alle Einträge mit mealGroupId = Gruppen-id und mealName = Gruppenname;
 * eine Mahlzeit darin wird in ihre Bestandteile aufgelöst. Eine Mahlzeit als Einzelvorschlag bekommt eine eigene
 * Gruppe wie beim Eintragen von Hand. missing wird übersprungen.
 */
export function suggestionEntries(
  parts: readonly PartChoice[],
  date: LocalDate,
  group: { id: string; name: string } | null,
  newId: () => string = () => crypto.randomUUID(),
): NewEntryFields[] {
  const inGroup = (e: NewEntryFields): NewEntryFields => (group ? { ...e, mealGroupId: group.id, mealName: group.name } : e)
  return parts.flatMap(({ part, slotId }): NewEntryFields[] => {
    switch (part.kind) {
      case 'food':
        return [inGroup(foodEntry(part.food, part.amount, date, slotId))]
      case 'meal':
        return mealEntries(part.meal, part.lines, part.scale, date, slotId, newId()).map(inGroup)
      case 'estimate':
        return [
          inGroup({
            date,
            slotId,
            kind: 'quick',
            ref: null,
            nameSnapshot: part.name,
            amount: part.amount,
            unit: part.unit,
            portionLabel: null,
            nutrients: { ...part.nutrients },
            mealGroupId: null,
            mealName: null,
            cost: null,
            estimated: true,
          }),
        ]
      case 'missing':
        return []
    }
  })
}

/** Bester Treffer für eine Schätzung, nur wenn jedes Wort als ganzes Wort im Namen vorkommt */
export function bestMatch<T>(name: string, index: SearchIndex<T>, getName: (item: T) => string): T | null {
  const [hit] = search(index, name, 1)
  if (hit === undefined) return null
  const words = new Set(normalize(getName(hit)).split(' '))
  return normalize(name)
    .split(' ')
    .filter(Boolean)
    .every((w) => words.has(w))
    ? hit
    : null
}

export function suggestionCountLabel(n: number): string {
  return `${n} ${n === 1 ? 'Vorschlag' : 'Vorschläge'} aus Fitboard`
}
