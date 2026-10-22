import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import type { ProductFormData } from '../logic/productForm.ts'
import { db } from './db.ts'
import {
  archiveProduct,
  createProduct,
  deleteProduct,
  getBlsPref,
  getProduct,
  isFoodUsed,
  restoreProduct,
  saveBlsPortions,
  setBlsUseOverride,
  saveProductPortions,
  updateProduct,
} from './products.ts'
import { newRecord, softDelete, unknownNutrients } from './records.ts'
import { getSetting, setSetting } from './settings.ts'
import type { Entry, Meal, Recipe } from './types.ts'

const t0 = new Date('2026-10-17T08:00:00.000Z')
const t1 = new Date('2026-10-18T08:00:00.000Z')

const skyr: ProductFormData = {
  name: 'Skyr natur',
  brand: 'Arla',
  barcode: null,
  unit: 'g',
  per100: { ...unknownNutrients(), kcal: 63, protein: 11 },
  portions: [{ label: '1 Becher', amount: 450 }],
}

function entryFor(ref: Entry['ref']) {
  return newRecord<Entry>({
    date: '2026-10-17',
    slotId: 'slot',
    kind: 'food',
    ref,
    nameSnapshot: 'Skyr',
    amount: 150,
    unit: 'g',
    portionLabel: null,
    nutrients: unknownNutrients(),
    mealGroupId: null,
    mealName: null,
  })
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('Produkte', () => {
  it('legt ein eigenes Produkt mit Sync-Feldern an', async () => {
    const p = await createProduct(skyr, t0)
    const stored = await getProduct(p.id)
    expect(stored).toEqual(p)
    expect(stored).toMatchObject({ source: 'own', archived: false, useOverride: true, offFetchedAt: null })
    expect(stored.createdAt).toBe(t0.toISOString())
    expect(stored.per100.fiber).toBeNull() // unbekannt bleibt null in der Datenbank
  })

  it('bearbeitet ein Produkt, behält id und createdAt', async () => {
    const p = await createProduct(skyr, t0)
    const u = await updateProduct(p.id, { ...skyr, name: 'Skyr', per100: { ...skyr.per100, kcal: 64 } }, t1)
    expect(u.id).toBe(p.id)
    expect(u.createdAt).toBe(t0.toISOString())
    expect(u.updatedAt).toBe(t1.toISOString())
    expect((await getProduct(p.id)).per100.kcal).toBe(64)
  })

  it('ändern eines Produkts ändert keine alten Einträge (Snapshot)', async () => {
    const p = await createProduct(skyr)
    const entry = { ...entryFor(`product:${p.id}`), nutrients: { ...unknownNutrients(), kcal: 94.5 } }
    await db.entries.add(entry)
    await updateProduct(p.id, { ...skyr, per100: { ...skyr.per100, kcal: 100 } })
    expect((await db.entries.get(entry.id))?.nutrients.kcal).toBe(94.5)
  })

  it('Portionen aus der Detailansicht speichern', async () => {
    const p = await createProduct(skyr, t0)
    await saveProductPortions(p.id, [{ label: 'Halber Becher', amount: 225 }], t1)
    const stored = await getProduct(p.id)
    expect(stored.portions).toEqual([{ label: 'Halber Becher', amount: 225 }])
    expect(stored.updatedAt).toBe(t1.toISOString())
    expect(stored.name).toBe('Skyr natur')
  })

  it('archivieren und wiederherstellen', async () => {
    const p = await createProduct(skyr)
    await archiveProduct(p.id)
    expect((await getProduct(p.id)).archived).toBe(true)
    await restoreProduct(p.id)
    expect((await getProduct(p.id)).archived).toBe(false)
  })

  it('löschen setzt nur den Löschmarker', async () => {
    const p = await createProduct(skyr, t0)
    await deleteProduct(p.id, t1)
    const raw = await db.products.get(p.id)
    expect(raw?.deletedAt).toBe(t1.toISOString())
    await expect(getProduct(p.id)).rejects.toThrow('nicht gefunden')
  })

  it('verwendete Produkte lassen sich nicht löschen', async () => {
    const p = await createProduct(skyr)
    await db.entries.add(entryFor(`product:${p.id}`))
    await expect(deleteProduct(p.id)).rejects.toThrow('archivieren')
    expect((await db.products.get(p.id))?.deletedAt).toBeNull()
  })

  it('unbekanntes Produkt bearbeiten schlägt fehl', async () => {
    await expect(updateProduct('gibts-nicht', skyr)).rejects.toThrow('nicht gefunden')
  })
})

describe('isFoodUsed', () => {
  it('erkennt Verwendung im Tagebuch, nicht bei gelöschten Einträgen', async () => {
    expect(await isFoodUsed('product:a')).toBe(false)
    await db.entries.add(softDelete(entryFor('product:a')))
    expect(await isFoodUsed('product:a')).toBe(false)
    await db.entries.add(entryFor('product:a'))
    expect(await isFoodUsed('product:a')).toBe(true)
    expect(await isFoodUsed('product:b')).toBe(false)
  })

  it('erkennt Verwendung in Mahlzeiten und Rezepten', async () => {
    await db.meals.add(
      newRecord<Meal>({
        name: 'Frühstück',
        items: [{ ref: 'bls:C133000', amount: 60, unit: 'g', portionLabel: null }],
        archived: false,
      }),
    )
    await db.recipes.add(
      newRecord<Recipe>({
        name: 'Chili',
        ingredients: [{ ref: 'product:x', amount: 500 }],
        finalWeightG: 1400,
        portions: [],
        archived: false,
      }),
    )
    expect(await isFoodUsed('bls:C133000')).toBe(true)
    expect(await isFoodUsed('product:x')).toBe(true)
  })
})

describe('BLS-Einstellungen', () => {
  it('speichert Portionen und legt nur einen Datensatz je Code an', async () => {
    await saveBlsPortions('F503100', [{ label: '1 Stück', amount: 120 }], t0)
    await saveBlsPortions('F503100', [{ label: '1 große', amount: 150 }], t1)
    const all = await db.blsPrefs.toArray()
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ blsCode: 'F503100', portions: [{ label: '1 große', amount: 150 }] })
    expect(all[0]!.createdAt).toBe(t0.toISOString())
  })

  it('Umschalter Meine/Original behält die Portionen', async () => {
    await saveBlsPortions('N100000', [{ label: '1 Tasse', amount: 200 }])
    await setBlsUseOverride('N100000', false)
    expect(await getBlsPref('N100000')).toMatchObject({ useOverride: false, portions: [{ label: '1 Tasse', amount: 200 }] })
  })

  it('belebt einen gelöschten Datensatz wieder statt doppelt anzulegen', async () => {
    await saveBlsPortions('F503100', [{ label: '1 Stück', amount: 120 }])
    const [pref] = await db.blsPrefs.toArray()
    await db.blsPrefs.put(softDelete(pref!))
    expect(await getBlsPref('F503100')).toBeUndefined()
    await saveBlsPortions('F503100', [{ label: 'neu', amount: 100 }])
    const all = await db.blsPrefs.toArray()
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ id: pref!.id, deletedAt: null, portions: [{ label: 'neu', amount: 100 }] })
  })
})

describe('Einstellungen', () => {
  it('speichert und liest Werte, ein Datensatz je Schlüssel', async () => {
    expect(await getSetting('theme')).toBeUndefined()
    await setSetting('theme', 'dark')
    await setSetting('theme', 'light')
    expect(await getSetting('theme')).toBe('light')
    expect(await db.settings.count()).toBe(1)
  })
})
