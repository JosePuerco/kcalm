import { describe, expect, it } from 'vitest'
import { newRecord, softDelete, unknownNutrients } from '../db/records.ts'
import type { BlsPref, Product, ProductOverride } from '../db/types.ts'
import type { BlsFood } from './blsFoods.ts'
import { buildFoodRows, countArchived, filterFoodRows } from './foodList.ts'

function product(name: string, changes: Partial<Product> = {}): Product {
  return {
    ...newRecord<Product>({
      source: 'own',
      barcode: null,
      name,
      brand: null,
      unit: 'g',
      per100: { ...unknownNutrients(), kcal: 100 },
      portions: [],
      isDrink: false,
      countsAsWater: false,
      useOverride: true,
      archived: false,
      offFetchedAt: null,
    }),
    ...changes,
  }
}

const blsFood = (code: string, name: string, kcal: number): BlsFood => ({
  code,
  name,
  per100: { ...unknownNutrients(), kcal },
})
const bls = new Map([
  ['F503100', blsFood('F503100', 'Banane roh', 93)],
  ['V400000', blsFood('V400000', 'Hähnchen Brust, roh', 110)],
  ['F201100', blsFood('F201100', 'Aprikose roh', 42)],
])

const prefs = (code: string, portions = [{ label: '1 Stück', amount: 120 }]) =>
  newRecord<BlsPref>({ blsCode: code, portions, isDrink: null, countsAsWater: null })

const verifiedOverride = (ref: ProductOverride['productRef'], verifiedAt: string | null = '2026-10-12T10:00:00.000Z') =>
  newRecord<ProductOverride>({ productRef: ref, per100: {}, verifiedAt, note: null })

describe('buildFoodRows', () => {
  const skyr = product('Skyr natur', { source: 'off', brand: 'Arla', per100: { ...unknownNutrients(), kcal: 63 } })
  const whey = product('Whey Vanille')
  const milk = product('Milch 1,5 %', { source: 'off', unit: 'ml' })

  it('baut Zeilen mit Meta-Text wie im Prototyp', () => {
    const rows = buildFoodRows({ products: [skyr, whey, milk], blsPrefs: [prefs('F503100')], overrides: [], bls })
    expect(rows.map((r) => [r.name, r.meta, r.kcalPer100])).toEqual([
      ['Banane roh', 'BLS · eigene Portion', 93],
      ['Milch 1,5 %', 'Open Food Facts', 100],
      ['Skyr natur', 'Arla · Open Food Facts', 63],
      ['Whey Vanille', 'Eigenes Produkt', 100],
    ])
    expect(rows.find((r) => r.name === 'Milch 1,5 %')?.unit).toBe('ml')
    expect(rows[0]!.ref).toBe('bls:F503100')
    expect(rows[3]!.ref).toBe(`product:${whey.id}`)
  })

  it('unbekannte kcal bleiben null', () => {
    const p = product('Ohne Angabe', { per100: unknownNutrients() })
    expect(buildFoodRows({ products: [p], blsPrefs: [], overrides: [], bls })[0]!.kcalPer100).toBeNull()
  })

  it('gelöschte Produkte erscheinen nicht', () => {
    const rows = buildFoodRows({ products: [softDelete(whey), skyr], blsPrefs: [], overrides: [], bls })
    expect(rows.map((r) => r.name)).toEqual(['Skyr natur'])
  })

  it('BLS nur mit eigener Portion oder Prüfung', () => {
    const rows = buildFoodRows({
      products: [],
      blsPrefs: [prefs('F503100'), prefs('V400000', []), softDelete(prefs('F201100'))],
      overrides: [verifiedOverride('bls:V400000')],
      bls,
    })
    expect(rows.map((r) => [r.name, r.meta, r.verified])).toEqual([
      ['Banane roh', 'BLS · eigene Portion', false],
      ['Hähnchen Brust, roh', 'BLS', true],
    ])
  })

  it('BLS-Codes, die es nicht mehr gibt, werden übersprungen', () => {
    const rows = buildFoodRows({ products: [], blsPrefs: [prefs('X999999')], overrides: [], bls })
    expect(rows).toEqual([])
  })

  it('geprüft nur mit aktivem Override und Prüfdatum', () => {
    const rows = buildFoodRows({
      products: [skyr, whey, milk],
      blsPrefs: [],
      overrides: [
        verifiedOverride(`product:${skyr.id}`),
        verifiedOverride(`product:${whey.id}`, null),
        softDelete(verifiedOverride(`product:${milk.id}`)),
      ],
      bls,
    })
    expect(rows.filter((r) => r.verified).map((r) => r.name)).toEqual(['Skyr natur'])
  })

  it('sortiert alphabetisch nach deutscher Sortierung, Umlaute richtig', () => {
    const rows = buildFoodRows({
      products: [product('Zwieback'), product('Äpfel'), product('apfelmus'), product('Müsli'), product('Mais')],
      blsPrefs: [],
      overrides: [],
      bls,
    })
    expect(rows.map((r) => r.name)).toEqual(['Äpfel', 'apfelmus', 'Mais', 'Müsli', 'Zwieback'])
  })
})

describe('filterFoodRows', () => {
  const rows = buildFoodRows({
    products: [
      product('Skyr', { source: 'off' }),
      product('Whey'),
      product('Alt', { archived: true }),
    ],
    blsPrefs: [prefs('F503100')],
    overrides: [],
    bls,
  })
  const names = (filter: Parameters<typeof filterFoodRows>[1], archived?: boolean) =>
    filterFoodRows(rows, filter, archived).map((r) => r.name)

  it('Alle zeigt alles außer Archiviertem', () => {
    expect(names('all')).toEqual(['Banane roh', 'Skyr', 'Whey'])
  })

  it('Eigene und BLS', () => {
    expect(names('own')).toEqual(['Whey'])
    expect(names('bls')).toEqual(['Banane roh'])
  })

  it('Geprüft ist leer, solange nichts geprüft ist', () => {
    expect(names('verified')).toEqual([])
  })

  it('Archiv-Ansicht zeigt nur Archiviertes', () => {
    expect(names('all', true)).toEqual(['Alt'])
    expect(countArchived(rows)).toBe(1)
  })
})
