// Produkte und BLS-Einstellungen speichern. Löschen = Löschmarker; verwendete Produkte
// werden nur archiviert (PLAN.md 2, Produkte).

import type { ProductFormData } from '../logic/productForm.ts'
import { db } from './db.ts'
import { newRecord, softDelete, touch, upsertByKey } from './records.ts'
import type { BlsPref, FoodRef, Portion, Product } from './types.ts'

export async function createProduct(data: ProductFormData, now = new Date()): Promise<Product> {
  const product = newRecord<Product>(
    {
      ...data,
      source: 'own',
      // Feinere Wasser-Regeln (Alkohol, Kaffee) kommen in Phase 7
      countsAsWater: data.isDrink,
      useOverride: true,
      archived: false,
      offFetchedAt: null,
    },
    now,
  )
  await db.products.add(product)
  return product
}

export async function updateProduct(id: string, data: ProductFormData, now = new Date()): Promise<Product> {
  return db.transaction('rw', db.products, async () => {
    const existing = await getProduct(id)
    const countsAsWater = data.isDrink === existing.isDrink ? existing.countsAsWater : data.isDrink
    const updated = touch(existing, { ...data, countsAsWater }, now)
    await db.products.put(updated)
    return updated
  })
}

export async function getProduct(id: string): Promise<Product> {
  const product = await db.products.get(id)
  if (!product || product.deletedAt !== null) throw new Error(`Produkt ${id} nicht gefunden`)
  return product
}

/** Verwendet im Tagebuch, in einer Mahlzeit oder einem Rezept (jeweils nicht gelöscht)? */
export async function isFoodUsed(ref: FoodRef): Promise<boolean> {
  const entries = await db.entries.where('ref').equals(ref).filter((e) => e.deletedAt === null).count()
  if (entries > 0) return true
  const meals = await db.meals.filter((m) => m.deletedAt === null && m.items.some((i) => i.ref === ref)).count()
  if (meals > 0) return true
  const recipes = await db.recipes
    .filter((r) => r.deletedAt === null && r.ingredients.some((i) => i.ref === ref))
    .count()
  return recipes > 0
}

/** Portionen direkt aus der Detailansicht ändern */
export async function saveProductPortions(id: string, portions: Portion[], now = new Date()): Promise<void> {
  await db.transaction('rw', db.products, async () => {
    await db.products.put(touch(await getProduct(id), { portions }, now))
  })
}

async function setArchived(id: string, archived: boolean, now: Date) {
  await db.transaction('rw', db.products, async () => {
    await db.products.put(touch(await getProduct(id), { archived }, now))
  })
}

export const archiveProduct = (id: string, now = new Date()) => setArchived(id, true, now)
export const restoreProduct = (id: string, now = new Date()) => setArchived(id, false, now)

/** Nur für unbenutzte Produkte; sonst archivieren */
export async function deleteProduct(id: string, now = new Date()): Promise<void> {
  await db.transaction('rw', [db.products, db.entries, db.meals, db.recipes], async () => {
    if (await isFoodUsed(`product:${id}`)) throw new Error('Produkt wird verwendet, bitte archivieren')
    await db.products.put(softDelete(await getProduct(id), now))
  })
}

export async function getBlsPref(code: string): Promise<BlsPref | undefined> {
  const pref = await db.blsPrefs.where('blsCode').equals(code).first()
  return pref?.deletedAt === null ? pref : undefined
}

/** Eigene Einstellung zu einem BLS-Lebensmittel ändern; legt sie bei Bedarf an (eindeutig je Code) */
async function updateBlsPref(code: string, changes: Partial<Pick<BlsPref, 'portions' | 'isDrink'>>, now: Date) {
  await db.transaction('rw', db.blsPrefs, async () => {
    const existing = await db.blsPrefs.where('blsCode').equals(code).first()
    const base =
      existing && existing.deletedAt === null
        ? { portions: existing.portions, isDrink: existing.isDrink, countsAsWater: existing.countsAsWater }
        : { portions: [], isDrink: null, countsAsWater: null }
    await db.blsPrefs.put(upsertByKey<BlsPref>(existing, { ...base, ...changes, blsCode: code }, now))
  })
}

export const saveBlsPortions = (code: string, portions: Portion[], now = new Date()) =>
  updateBlsPref(code, { portions }, now)

export const setBlsIsDrink = (code: string, isDrink: boolean, now = new Date()) =>
  updateBlsPref(code, { isDrink }, now)
