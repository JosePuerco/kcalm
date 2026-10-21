import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import { choiceFromProduct, foodEntry } from '../logic/addFood.ts'
import { db } from './db.ts'
import { addEntry, loadFoodSources } from './entries.ts'
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
  })
})
