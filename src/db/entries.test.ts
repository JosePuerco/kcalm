import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import { choiceFromEntry, choiceFromProduct, editedEntry, foodEntry } from '../logic/addFood.ts'
import { db } from './db.ts'
import { addEntry, copyEntries, deleteEntry, getDayEntries, getEntry, loadFoodSources, updateEntry } from './entries.ts'
import { createProduct, updateProduct } from './products.ts'
import { unknownNutrients } from './records.ts'

const t0 = new Date('2026-10-21T08:00:00.000Z')
const t1 = new Date('2026-10-21T09:00:00.000Z')

const skyr = {
  name: 'Skyr natur',
  brand: 'Arla',
  barcode: null,
  unit: 'g' as const,
  per100: { ...unknownNutrients(), kcal: 63, protein: 11 },
  isDrink: false,
  portions: [{ label: '1 Becher', amount: 250 }],
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('addEntry', () => {
  it('speichert den Eintrag mit sync-fähigen Feldern', async () => {
    const product = await createProduct(skyr, t0)
    const e = await addEntry(foodEntry(choiceFromProduct(product), 250, '2026-10-21', 'snacks'), t1)
    expect(await db.entries.get(e.id)).toMatchObject({
      nameSnapshot: 'Skyr natur',
      createdAt: t1.toISOString(),
      deletedAt: null,
      nutrients: { kcal: 157.5 },
    })
  })

  it('Snapshot-Prinzip: späteres Ändern des Produkts ändert den Eintrag nicht', async () => {
    const product = await createProduct(skyr, t0)
    const e = await addEntry(foodEntry(choiceFromProduct(product), 100, '2026-10-21', 's'), t0)
    await updateProduct(product.id, { ...skyr, name: 'Skyr neu', per100: { ...skyr.per100, kcal: 80 } }, t1)
    expect(await db.entries.get(e.id)).toMatchObject({ nameSnapshot: 'Skyr natur', nutrients: { kcal: 63 } })
  })
})

describe('loadFoodSources', () => {
  it('ohne gelöschte Produkte, mit jüngsten Einträgen', async () => {
    const product = await createProduct(skyr, t0)
    await db.products.update(product.id, { deletedAt: t1.toISOString() })
    await createProduct({ ...skyr, name: 'Quark' }, t0)
    await addEntry(foodEntry(choiceFromProduct(product), 100, '2026-10-21', 's'), t0)
    const s = await loadFoodSources()
    expect(s.products.map((p) => p.name)).toEqual(['Quark'])
    expect(s.recent).toHaveLength(1)
    expect(s.meals).toEqual([])
    expect(s.recipes).toEqual([])
  })
})

describe('updateEntry / deleteEntry', () => {
  it('ändert Menge, Slot und Tag; id und createdAt bleiben', async () => {
    const product = await createProduct(skyr, t0)
    const e = await addEntry(foodEntry(choiceFromProduct(product), 250, '2026-10-21', 'snacks'), t0)
    const changes = editedEntry(choiceFromEntry(e), 100, '2026-10-20', 'abend')
    const u = await updateEntry(e.id, changes, t1)
    expect(u).toMatchObject({ id: e.id, createdAt: t0.toISOString(), updatedAt: t1.toISOString(), date: '2026-10-20', slotId: 'abend', amount: 100 })
    expect((await db.entries.get(e.id))?.nutrients.kcal).toBeCloseTo(63, 10)
  })

  it('Löschen setzt den Löschmarker, der Datensatz bleibt (Sync)', async () => {
    const product = await createProduct(skyr, t0)
    const e = await addEntry(foodEntry(choiceFromProduct(product), 250, '2026-10-21', 's'), t0)
    await deleteEntry(e.id, t1)
    expect(await db.entries.get(e.id)).toMatchObject({ deletedAt: t1.toISOString(), updatedAt: t1.toISOString() })
    await expect(getEntry(e.id)).rejects.toThrow()
    await expect(deleteEntry(e.id, t1)).rejects.toThrow()
  })
})

describe('copyEntries', () => {
  it('kopiert den ganzen Tag oder einen Slot mit Snapshots; Quelle bleibt unverändert', async () => {
    const product = await createProduct(skyr, t0)
    const food = choiceFromProduct(product)
    await addEntry(foodEntry(food, 250, '2026-10-20', 'frueh'), t0)
    await addEntry(foodEntry(food, 100, '2026-10-20', 'abend'), new Date(t0.getTime() + 1000))
    // Produkt ändert sich danach: Kopie übernimmt trotzdem den gespeicherten Wert
    await updateProduct(product.id, { ...skyr, per100: { ...skyr.per100, kcal: 80 } }, t0)

    const all = await copyEntries('2026-10-20', '2026-10-21', undefined, t1)
    expect(all.map((e) => [e.date, e.slotId, e.nutrients.kcal])).toEqual([
      ['2026-10-21', 'frueh', 157.5],
      ['2026-10-21', 'abend', 63],
    ])
    expect(all[0]?.createdAt).toBe(t1.toISOString())
    expect(await getDayEntries('2026-10-20')).toHaveLength(2)

    const one = await copyEntries('2026-10-20', '2026-10-22', 'abend', t1)
    expect(one).toHaveLength(1)
  })

  it('nicht in denselben Tag', async () => {
    await expect(copyEntries('2026-10-20', '2026-10-20')).rejects.toThrow()
  })
})
