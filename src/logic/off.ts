// Open Food Facts (PLAN.md 3): Adressen mit App-Kennung, Prüfung der Antwort mit Zod und
// Umwandlung in ein Kcalm-Produkt. Reine Funktionen; die Abfrage selbst steht in src/db/off.ts.
// Grundsatz: OFF-Daten sind von Freiwilligen eingetippt. Ein kaputter Einzelwert wird null
// (unbekannt), das Produkt bleibt nutzbar. Nie 0 für „unbekannt“.

import { z } from 'zod'
import type { Nutrients, Portion, Product, Unit } from '../db/types.ts'
import { normalizeBarcode } from './barcode.ts'

export const OFF_BASE = 'https://world.openfoodfacts.org'

/** App-Kennung für OFF (User-Agent ist im Browser nicht setzbar) */
export interface OffApp {
  name: string
  version: string
  uuid: string
}

/** Nur die benötigten Felder abfragen */
export const OFF_FIELDS = [
  'code',
  'product_name',
  'product_name_de',
  'generic_name',
  'generic_name_de',
  'brands',
  'product_quantity',
  'product_quantity_unit',
  'serving_quantity',
  'nutrition_data_per',
  'categories_tags',
  'nutriments',
] as const

/** 1 kcal = 4,184 kJ (Definition) */
export const KJ_PER_KCAL = 4.184
/** Salz = Natrium × 2,5 (LMIV Anhang XIV) */
export const SALT_PER_SODIUM = 2.5
/** Größer kann ein Wert pro 100 g nicht sein; alles darüber ist ein Tippfehler bei OFF */
const MAX_KCAL = 900
const MAX_GRAMS = 100
/** Wie im Produktformular */
const MAX_PORTION = 10000

const SEARCH_PAGE_SIZE = 20

function appParams(app: OffApp): Record<string, string> {
  return { app_name: app.name, app_version: app.version, app_uuid: app.uuid }
}

export function productUrl(barcode: string, app: OffApp): string {
  const params = new URLSearchParams({ fields: OFF_FIELDS.join(','), ...appParams(app) })
  return `${OFF_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?${params}`
}

/** Textsuche; laut Kurztest (PLAN.md 3) die einzige, die der Browser abfragen darf (CORS) */
export function searchUrl(terms: string, app: OffApp): string {
  const params = new URLSearchParams({
    search_terms: terms.trim(),
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(SEARCH_PAGE_SIZE),
    fields: OFF_FIELDS.join(','),
    ...appParams(app),
  })
  return `${OFF_BASE}/cgi/search.pl?${params}`
}

// ---------- Prüfen ----------

/** Zahl oder Text („4,5“, „4.5“) → Zahl ≥ 0; alles andere → null */
export function looseNumber(value: unknown): number | null {
  let n: number
  if (typeof value === 'number') n = value
  else if (typeof value === 'string' && /^\s*\d+([.,]\d+)?\s*$/.test(value)) n = Number(value.trim().replace(',', '.'))
  else return null
  return Number.isFinite(n) && n >= 0 ? n : null
}

// optional(): Felder dürfen fehlen (Zod 4 macht ein Feld mit transform sonst zur Pflicht)
const loose = z.unknown().optional()
const text = loose.transform((v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null))
const number = loose.transform(looseNumber)

const productSchema = z.object({
  code: text,
  product_name: text,
  product_name_de: text,
  generic_name: text,
  generic_name_de: text,
  brands: text,
  product_quantity: number,
  product_quantity_unit: text,
  serving_quantity: number,
  nutrition_data_per: text,
  categories_tags: loose.transform((v) => (Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : [])),
  nutriments: loose.transform((v) =>
    typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {},
  ),
})

type OffRaw = z.infer<typeof productSchema>

const productResponseSchema = z.object({
  status: z.union([z.literal(0), z.literal(1)]),
  product: productSchema.optional(),
})

const searchResponseSchema = z.object({
  products: z.array(z.unknown()),
})

// ---------- Umwandeln ----------

/** Was Kcalm aus einem OFF-Produkt übernimmt */
export type OffProduct = Pick<
  Product,
  'barcode' | 'name' | 'brand' | 'unit' | 'per100' | 'portions' | 'isDrink' | 'countsAsWater'
>

export const UNNAMED_PRODUCT = 'Unbenanntes Produkt'

function limited(value: number | null, max: number): number | null {
  return value !== null && value <= max ? value : null
}

/** Nährwerte pro 100 g/ml, nur aus den _100g-Feldern; intern exakt, nicht gerundet */
export function offNutrients(n: Record<string, unknown>): Nutrients {
  const grams = (key: string) => limited(looseNumber(n[`${key}_100g`]), MAX_GRAMS)

  // kcal vom Etikett; fehlt er, aus kJ (energy_100g ist bei OFF immer kJ)
  let kcal = looseNumber(n['energy-kcal_100g'])
  if (kcal === null) {
    const kj = looseNumber(n['energy-kj_100g']) ?? looseNumber(n['energy_100g'])
    kcal = kj === null ? null : kj / KJ_PER_KCAL
  }

  let salt = grams('salt')
  if (salt === null) {
    const sodium = grams('sodium')
    salt = limited(sodium === null ? null : sodium * SALT_PER_SODIUM, MAX_GRAMS)
  }

  return {
    kcal: limited(kcal, MAX_KCAL),
    fat: grams('fat'),
    satFat: grams('saturated-fat'),
    carbs: grams('carbohydrates'),
    sugar: grams('sugars'),
    fiber: grams('fiber'),
    protein: grams('proteins'),
    salt,
    water: null, // OFF führt keinen verlässlichen Wassergehalt
  }
}

function offUnit(raw: OffRaw): Unit {
  if (raw.nutrition_data_per === '100ml') return 'ml'
  const unit = raw.product_quantity_unit?.toLowerCase()
  return unit === 'ml' || unit === 'cl' || unit === 'l' ? 'ml' : 'g'
}

function offPortions(raw: OffRaw): Portion[] {
  const portions: Portion[] = []
  const valid = (n: number | null): n is number => n !== null && n > 0 && n <= MAX_PORTION
  if (valid(raw.serving_quantity)) portions.push({ label: '1 Portion', amount: raw.serving_quantity })
  if (valid(raw.product_quantity) && raw.product_quantity !== raw.serving_quantity) {
    portions.push({ label: '1 Packung', amount: raw.product_quantity })
  }
  return portions
}

function offName(raw: OffRaw): string | null {
  return raw.product_name_de ?? raw.product_name ?? raw.generic_name_de ?? raw.generic_name
}

/** Geprüftes OFF-Produkt → Kcalm-Produktdaten; barcode = der gescannte Code (Einheitsform) */
export function offToProduct(raw: OffRaw, barcode: string | null): OffProduct {
  const isDrink = raw.categories_tags.includes('en:beverages')
  return {
    barcode,
    name: offName(raw) ?? UNNAMED_PRODUCT,
    brand: raw.brands?.split(',')[0]?.trim() || null,
    unit: offUnit(raw),
    per100: offNutrients(raw.nutriments),
    portions: offPortions(raw),
    isDrink,
    // Feinere Wasser-Regeln kommen in Phase 7
    countsAsWater: isDrink && !raw.categories_tags.includes('en:alcoholic-beverages'),
  }
}

export type OffProductResult = { kind: 'found'; product: OffProduct } | { kind: 'notFound' } | { kind: 'invalid' }

/** Antwort von /api/v2/product/{code}.json (auch bei HTTP 404: dann status 0) */
export function parseProductResponse(json: unknown, barcode: string): OffProductResult {
  const result = productResponseSchema.safeParse(json)
  if (!result.success) return { kind: 'invalid' }
  const { status, product } = result.data
  if (status === 0) return { kind: 'notFound' }
  if (!product) return { kind: 'invalid' }
  return { kind: 'found', product: offToProduct(product, barcode) }
}

/** Antwort der Textsuche; Treffer ohne Namen werden ausgelassen, null = Antwort unbrauchbar */
export function parseSearchResponse(json: unknown): OffProduct[] | null {
  const result = searchResponseSchema.safeParse(json)
  if (!result.success) return null
  const products: OffProduct[] = []
  for (const item of result.data.products) {
    const raw = productSchema.safeParse(item)
    if (!raw.success || offName(raw.data) === null) continue
    const barcode = raw.data.code === null ? null : (normalizeBarcode(raw.data.code) ?? raw.data.code)
    products.push(offToProduct(raw.data, barcode))
  }
  return products
}
