// Datenmodell nach PLAN.md Abschnitt 4. Jede Tabelle ist sync-fähig (SyncFields).

/** Zahl = bekannt, null = unbekannt. Nie 0 für „unbekannt“. */
export type NutrientValue = number | null

export interface Nutrients {
  kcal: NutrientValue
  fat: NutrientValue
  satFat: NutrientValue
  carbs: NutrientValue
  sugar: NutrientValue
  fiber: NutrientValue
  protein: NutrientValue
  salt: NutrientValue
  water: NutrientValue
}
export type NutrientKey = keyof Nutrients

/** Lokales Kalenderdatum „YYYY-MM-DD“ (Tag beginnt um Mitternacht) */
export type LocalDate = string
/** Zeitpunkt als ISO-String „2026-10-17T12:34:56.789Z“ (sortierbar, im Backup lesbar) */
export type Timestamp = string

export interface SyncFields {
  /** UUID */
  id: string
  createdAt: Timestamp
  updatedAt: Timestamp
  /** Löschmarker statt echtem Löschen */
  deletedAt: Timestamp | null
}

export type Unit = 'g' | 'ml'

/** Verweis auf ein Lebensmittel als String, damit er indexierbar ist */
export type FoodRef = `product:${string}` | `bls:${string}` | `recipe:${string}`

/** Portionsgröße, amount in g bzw. ml */
export interface Portion {
  label: string
  amount: number
}

export interface Product extends SyncFields {
  source: 'off' | 'own'
  barcode: string | null
  name: string
  brand: string | null
  unit: Unit
  per100: Nutrients
  portions: Portion[]
  isDrink: boolean
  countsAsWater: boolean
  /** Korrekturschicht für künftige Einträge nutzen */
  useOverride: boolean
  archived: boolean
  offFetchedAt: Timestamp | null
}

/** Korrekturschicht fürs Verifizieren; das Original bleibt unverändert */
export interface ProductOverride extends SyncFields {
  /** „product:…“ oder „bls:…“, eindeutig */
  productRef: FoodRef
  /** Feld fehlt = Original gilt; null = bewusst „unbekannt“ */
  per100: Partial<Nutrients>
  verifiedAt: Timestamp | null
  note: string | null
}

/** Eigene Portionen und Wasser-Einstellung für BLS-Lebensmittel */
export interface BlsPref extends SyncFields {
  /** eindeutig */
  blsCode: string
  portions: Portion[]
  /** null = Standard aus den BLS-Daten */
  isDrink: boolean | null
  countsAsWater: boolean | null
}

export interface MealItem {
  ref: FoodRef
  amount: number
  unit: Unit
  portionLabel: string | null
}

export interface Meal extends SyncFields {
  name: string
  items: MealItem[]
  archived: boolean
}

export interface RecipeIngredient {
  ref: FoodRef
  /** Rohmenge in g bzw. ml */
  amount: number
}

/** Nährwerte pro 100 g werden aus den Zutaten berechnet, nicht gespeichert */
export interface Recipe extends SyncFields {
  name: string
  ingredients: RecipeIngredient[]
  finalWeightG: number
  portions: Portion[]
  archived: boolean
}

export interface Slot extends SyncFields {
  name: string
  order: number
  /** „HH:MM“ */
  timeFrom: string | null
  timeTo: string | null
  archived: boolean
}

export interface Entry extends SyncFields {
  date: LocalDate
  slotId: string
  kind: 'food' | 'quick' | 'water'
  /** null bei Schnell- und Wassereintrag */
  ref: FoodRef | null
  nameSnapshot: string
  /** null bei Schnelleintrag */
  amount: number | null
  unit: Unit | null
  portionLabel: string | null
  /** Snapshot, absolute Werte für diesen Eintrag */
  nutrients: Nutrients
  /** 0 = zählt nicht zum Wasser */
  waterMl: number
  mealGroupId: string | null
  mealName: string | null
}

/** Nur Tage mit Markierung; Datum eindeutig */
export interface Day extends SyncFields {
  date: LocalDate
  complete: boolean
}

export interface Profile extends SyncFields {
  name: string
  archived: boolean
}

export type MacroMode = 'g' | 'percent' | 'gPerKg' | 'rest'

export interface MacroTarget {
  mode: MacroMode
  /** null bei 'rest' */
  value: number | null
}

/** Ändern erzeugt eine neue Version, die alte bleibt für die Historie */
export interface ProfileVersion extends SyncFields {
  profileId: string
  weeklyKcal: number
  protein: MacroTarget
  fat: MacroTarget
  carbs: MacroTarget
  fiberG: number | null
  waterMl: number | null
  manualWeightKg: number | null
}

export interface ProfileAssignment extends SyncFields {
  validFrom: LocalDate
  profileVersionId: string
  /** Wochenbudget dieser Woche beim Wechsel „ab heute“ */
  weekBudgetOverride: number | null
}

export interface Weight extends SyncFields {
  date: LocalDate
  kg: number
  source: 'health' | 'manual'
  measuredAt: Timestamp
}

export interface PendingScan extends SyncFields {
  barcode: string
  scannedAt: Timestamp
  slotId: string | null
  date: LocalDate | null
}

/** Schlüssel eindeutig */
export interface Setting extends SyncFields {
  key: string
  value: unknown
}
