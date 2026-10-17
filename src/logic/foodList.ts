// Zeilen der Lebensmittel-Liste (Reiter Produkte): eigene und OFF-Produkte,
// dazu BLS-Lebensmittel, sobald sie eine eigene Portion haben oder geprüft sind.

import type { BlsPref, FoodRef, Product, ProductOverride, Unit } from '../db/types.ts'
import type { BlsFood } from './blsFoods.ts'

export type FoodFilter = 'all' | 'verified' | 'own' | 'bls'

export interface FoodRow {
  ref: FoodRef
  kind: 'off' | 'own' | 'bls'
  name: string
  brand: string | null
  /** „Arla · Open Food Facts“, „Eigenes Produkt“, „BLS · eigene Portion“ */
  meta: string
  kcalPer100: number | null
  unit: Unit
  verified: boolean
  archived: boolean
}

export const SOURCE_LABEL = { off: 'Open Food Facts', own: 'Eigenes Produkt', bls: 'BLS' } as const

interface Input {
  products: readonly Product[]
  blsPrefs: readonly BlsPref[]
  overrides: readonly ProductOverride[]
  bls: ReadonlyMap<string, BlsFood>
}

export function buildFoodRows({ products, blsPrefs, overrides, bls }: Input): FoodRow[] {
  const verified = new Set(
    overrides.filter((o) => o.deletedAt === null && o.verifiedAt !== null).map((o) => o.productRef),
  )
  const rows: FoodRow[] = []

  for (const p of products) {
    if (p.deletedAt !== null) continue
    const ref: FoodRef = `product:${p.id}`
    rows.push({
      ref,
      kind: p.source,
      name: p.name,
      brand: p.brand,
      meta: [p.brand, SOURCE_LABEL[p.source]].filter(Boolean).join(' · '),
      kcalPer100: p.per100.kcal,
      unit: p.unit,
      verified: verified.has(ref),
      archived: p.archived,
    })
  }

  // BLS: nur mit eigener Portion oder Prüfung (PLAN.md 2, Produkte)
  const withPortion = new Set(blsPrefs.filter((b) => b.deletedAt === null && b.portions.length > 0).map((b) => b.blsCode))
  const blsCodes = new Set(withPortion)
  for (const ref of verified) if (ref.startsWith('bls:')) blsCodes.add(ref.slice(4))

  for (const code of blsCodes) {
    const food = bls.get(code)
    if (!food) continue // Code gibt es in dieser BLS-Version nicht mehr
    const ref: FoodRef = `bls:${code}`
    rows.push({
      ref,
      kind: 'bls',
      name: food.name,
      brand: null,
      meta: withPortion.has(code) ? 'BLS · eigene Portion' : 'BLS',
      kcalPer100: food.per100.kcal,
      unit: 'g',
      verified: verified.has(ref),
      archived: false,
    })
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }))
}

/** Filter-Chip anwenden; archivierte Zeilen nur in der Archiv-Ansicht */
export function filterFoodRows(rows: readonly FoodRow[], filter: FoodFilter, archived = false): FoodRow[] {
  return rows.filter((r) => {
    if (r.archived !== archived) return false
    if (filter === 'verified') return r.verified
    if (filter === 'own') return r.kind === 'own'
    if (filter === 'bls') return r.kind === 'bls'
    return true
  })
}

export function countArchived(rows: readonly FoodRow[]): number {
  return rows.filter((r) => r.archived).length
}
