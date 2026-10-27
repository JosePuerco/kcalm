import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { choiceFromProduct, foodEntry } from '../logic/addFood.ts'
import { mergeNutrients } from '../logic/verify.ts'
import { db } from './db.ts'
import { addEntry, getEntry } from './entries.ts'
import { createMeal, getMeal } from './meals.ts'
import { lookupBarcode, refreshOffProduct, type Network } from './off.ts'
import { getBlsPref, getProduct } from './products.ts'
import type { FoodRef, Product } from './types.ts'
import { getOverride, saveCorrection, setUnit, setUseOverride, setVerified } from './verify.ts'

const T0 = new Date('2026-10-12T08:00:00.000Z')
const T1 = new Date('2026-10-21T12:00:00.000Z')
const BARCODE = '4002971243802'

function offAnswer(nutriments: Record<string, number>) {
  return {
    status: 1,
    product: { code: BARCODE, product_name: 'Skyr natur', brands: 'Arla', nutriments },
  }
}
const SKYR = {
  'energy-kcal_100g': 63,
  fat_100g: 0.2,
  'saturated-fat_100g': 0.1,
  carbohydrates_100g: 4,
  sugars_100g: 4,
  proteins_100g: 11,
  salt_100g: 0.1,
}

function network(body: unknown, status = 200): Network {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }))
  return { fetch: fetchMock, isOnline: () => true, timeoutMs: 1000 }
}

async function scannedSkyr(): Promise<Product> {
  const result = await lookupBarcode(BARCODE, network(offAnswer(SKYR)), T0)
  if (result.kind !== 'fetched') throw new Error(result.kind)
  return result.product
}

const refOf = (p: Product): FoodRef => `product:${p.id}`

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('saveCorrection', () => {
  it('speichert nur Abweichungen, Original bleibt', async () => {
    const skyr = await scannedSkyr()
    await saveCorrection(refOf(skyr), skyr.per100, { ...skyr.per100, carbs: 3.5, fiber: 0 }, T1)
    expect((await getOverride(refOf(skyr)))?.per100).toEqual({ carbs: 3.5, fiber: 0 })
    expect((await getProduct(skyr.id)).per100.carbs).toBe(4)
  })

  it('alles zurück auf Original → Löschmarker; neue Korrektur belebt denselben Datensatz', async () => {
    const skyr = await scannedSkyr()
    await saveCorrection(refOf(skyr), skyr.per100, { ...skyr.per100, kcal: 65 }, T0)
    const first = await getOverride(refOf(skyr))
    await saveCorrection(refOf(skyr), skyr.per100, skyr.per100, T1)
    expect(await getOverride(refOf(skyr))).toBeUndefined()
    await saveCorrection(refOf(skyr), skyr.per100, { ...skyr.per100, kcal: 66 }, T1)
    expect((await getOverride(refOf(skyr)))?.id).toBe(first?.id)
    expect(await db.productOverrides.count()).toBe(1)
  })

  it('Bearbeiten behält eine Prüfung', async () => {
    const skyr = await scannedSkyr()
    await setVerified(refOf(skyr), skyr.per100, true, T0)
    await saveCorrection(refOf(skyr), skyr.per100, { ...skyr.per100, salt: 0.13 }, T1)
    expect(await getOverride(refOf(skyr))).toMatchObject({ per100: { salt: 0.13 }, verifiedAt: T0.toISOString() })
  })
})

describe('setUnit', () => {
  it('ml bei Milch: eigener Datensatz, Original bleibt; zurück auf das Original → Löschmarker', async () => {
    const ref: FoodRef = 'bls:M111100'
    await setUnit(ref, 'g', 'ml', T0)
    expect(await getOverride(ref)).toMatchObject({ unit: 'ml', per100: {}, verifiedAt: null })
    await setUnit(ref, 'g', 'g', T1)
    expect(await getOverride(ref)).toBeUndefined()
  })

  it('Korrektur und Prüfung bleiben beim Umstellen, Einheit bleibt beim Korrigieren und Prüfen', async () => {
    const skyr = await scannedSkyr()
    await saveCorrection(refOf(skyr), skyr.per100, { ...skyr.per100, salt: 0.13 }, T0)
    await setVerified(refOf(skyr), skyr.per100, true, T0)
    await setUnit(refOf(skyr), skyr.unit, 'ml', T1)
    expect(await getOverride(refOf(skyr))).toMatchObject({ unit: 'ml', per100: { salt: 0.13 }, verifiedAt: T0.toISOString() })
    await saveCorrection(refOf(skyr), skyr.per100, { ...skyr.per100, salt: 0.12 }, T1)
    await setVerified(refOf(skyr), skyr.per100, false, T1)
    expect(await getOverride(refOf(skyr))).toMatchObject({ unit: 'ml', per100: { salt: 0.12 }, verifiedAt: null })
    expect((await getProduct(skyr.id)).unit).toBe('g')
  })

  it('alte Einträge und Mahlzeiten bekommen die Einheit, nichts wird umgerechnet', async () => {
    const skyr = await scannedSkyr()
    const choice = choiceFromProduct(skyr)
    const entry = await addEntry(foodEntry(choice, 250, '2026-10-12', 'slot'), T0)
    const meal = await createMeal(
      { name: 'Frühstück', items: [{ ref: refOf(skyr), amount: 250, unit: 'g', portionLabel: null }] },
      T0,
    )
    await setUnit(refOf(skyr), skyr.unit, 'ml', T1)
    const changed = await getEntry(entry.id)
    expect(changed).toMatchObject({ unit: 'ml', amount: 250, nutrients: entry.nutrients })
    expect((await getMeal(meal.id)).items[0]).toMatchObject({ unit: 'ml', amount: 250 })
    await setUnit(refOf(skyr), skyr.unit, 'g', T1)
    expect((await getEntry(entry.id))?.unit).toBe('g')
  })

  it('nur Einheit: Prüfung entfernen löscht den Datensatz nicht', async () => {
    const skyr = await scannedSkyr()
    await setUnit(refOf(skyr), skyr.unit, 'ml', T0)
    await setVerified(refOf(skyr), skyr.per100, true, T0)
    await setVerified(refOf(skyr), skyr.per100, false, T1)
    expect((await getOverride(refOf(skyr)))?.unit).toBe('ml')
  })
})

describe('setVerified', () => {
  it('„Stimmt so“: Prüfung ohne geänderte Felder', async () => {
    const skyr = await scannedSkyr()
    await setVerified(refOf(skyr), skyr.per100, true, T1)
    expect(await getOverride(refOf(skyr))).toMatchObject({ per100: {}, verifiedAt: T1.toISOString() })
  })

  it('ohne alle Pflichtangaben nicht möglich', async () => {
    const skyr = await scannedSkyr()
    const gap = { ...skyr.per100, satFat: null }
    await expect(setVerified(refOf(skyr), gap, true, T1)).rejects.toThrow('Pflichtangaben')
    expect(await getOverride(refOf(skyr))).toBeUndefined()
  })

  it('eine Korrektur kann die Lücke füllen', async () => {
    const skyr = await scannedSkyr()
    const gap = { ...skyr.per100, satFat: null }
    await saveCorrection(refOf(skyr), gap, { ...gap, satFat: 0.1 }, T0)
    await setVerified(refOf(skyr), gap, true, T1)
    expect((await getOverride(refOf(skyr)))?.verifiedAt).toBe(T1.toISOString())
  })

  it('Prüfung entfernen lässt Korrekturen stehen; ohne Korrekturen Löschmarker', async () => {
    const skyr = await scannedSkyr()
    await saveCorrection(refOf(skyr), skyr.per100, { ...skyr.per100, kcal: 65 }, T0)
    await setVerified(refOf(skyr), skyr.per100, true, T0)
    await setVerified(refOf(skyr), skyr.per100, false, T1)
    expect(await getOverride(refOf(skyr))).toMatchObject({ per100: { kcal: 65 }, verifiedAt: null })

    await saveCorrection(refOf(skyr), skyr.per100, skyr.per100, T1)
    expect(await getOverride(refOf(skyr))).toBeUndefined()
  })
})

describe('setUseOverride', () => {
  it('Produkt: Umschalter im Produkt', async () => {
    const skyr = await scannedSkyr()
    await setUseOverride(refOf(skyr), false, T1)
    expect((await getProduct(skyr.id)).useOverride).toBe(false)
  })

  it('BLS: Umschalter in blsPrefs, Portionen bleiben leer', async () => {
    await setUseOverride('bls:F503100', false, T1)
    expect(await getBlsPref('F503100')).toMatchObject({ useOverride: false, portions: [] })
  })
})

describe('refreshOffProduct', () => {
  it('OFF-Update überschreibt Korrektur nicht', async () => {
    const skyr = await scannedSkyr()
    const ref = refOf(skyr)
    await saveCorrection(ref, skyr.per100, { ...skyr.per100, carbs: 3.5 }, T0)
    await setVerified(ref, skyr.per100, true, T0)
    const mineBefore = mergeNutrients(skyr.per100, await getOverride(ref))

    const update = offAnswer({ ...SKYR, 'energy-kcal_100g': 65, carbohydrates_100g: 4.2 })
    const result = await refreshOffProduct(skyr.id, network(update), T1)

    expect(result.kind).toBe('updated')
    const product = await getProduct(skyr.id)
    // Nur das Original ändert sich
    expect(product.per100).toMatchObject({ kcal: 65, carbs: 4.2 })
    expect(product.offFetchedAt).toBe(T1.toISOString())
    const override = await getOverride(ref)
    expect(override).toMatchObject({ per100: { carbs: 3.5, kcal: 63 }, verifiedAt: T0.toISOString() })
    expect(mergeNutrients(product.per100, override)).toEqual(mineBefore)
  })

  it('ohne Korrektur übernimmt das Produkt das neue Original', async () => {
    const skyr = await scannedSkyr()
    await refreshOffProduct(skyr.id, network(offAnswer({ ...SKYR, 'energy-kcal_100g': 65 })), T1)
    expect((await getProduct(skyr.id)).per100.kcal).toBe(65)
    expect(await getOverride(refOf(skyr))).toBeUndefined()
  })

  it('Portionen und Umschalter bleiben', async () => {
    const skyr = await scannedSkyr()
    await db.products.update(skyr.id, { portions: [{ label: '1 Becher', amount: 450 }], useOverride: false })
    await refreshOffProduct(skyr.id, network(offAnswer(SKYR)), T1)
    expect(await getProduct(skyr.id)).toMatchObject({ portions: [{ label: '1 Becher', amount: 450 }], useOverride: false })
  })

  it('alte Tagebucheinträge ändern sich nicht (Snapshot)', async () => {
    const skyr = await scannedSkyr()
    const entry = await addEntry(foodEntry(choiceFromProduct(skyr), 100, '2026-10-12', 'slot'), T0)
    await refreshOffProduct(skyr.id, network(offAnswer({ ...SKYR, 'energy-kcal_100g': 80 })), T1)
    expect((await getEntry(entry.id)).nutrients.kcal).toBe(63)
  })

  it('OFF ohne kcal: nichts ändert sich', async () => {
    const skyr = await scannedSkyr()
    const noKcal: Record<string, number> = { ...SKYR }
    delete noKcal['energy-kcal_100g']
    expect((await refreshOffProduct(skyr.id, network(offAnswer(noKcal)), T1)).kind).toBe('noNutrients')
    expect(await getProduct(skyr.id)).toEqual(skyr)
  })

  it('nicht gefunden und nicht erreichbar: nichts ändert sich', async () => {
    const skyr = await scannedSkyr()
    expect((await refreshOffProduct(skyr.id, network({ status: 0 }, 404), T1)).kind).toBe('notFound')
    expect((await refreshOffProduct(skyr.id, network({}, 503), T1)).kind).toBe('unreachable')
    expect(await getProduct(skyr.id)).toEqual(skyr)
  })

  it('nur für OFF-Produkte', async () => {
    const own = { ...(await scannedSkyr()), source: 'own' as const }
    await db.products.put(own)
    await expect(refreshOffProduct(own.id, network(offAnswer(SKYR)), T1)).rejects.toThrow('Kein OFF-Produkt')
  })
})
