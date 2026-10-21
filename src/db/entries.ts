// Tagebucheinträge speichern und die Quellen fürs Hinzufügen-Sheet laden.

import type { NewEntryFields } from '../logic/addFood.ts'
import { db } from './db.ts'
import { newRecord } from './records.ts'
import type { BlsPref, Entry, Product, ProductOverride } from './types.ts'

export async function addEntry(fields: NewEntryFields, now = new Date()): Promise<Entry> {
  const entry = newRecord<Entry>(fields, now)
  await db.entries.add(entry)
  return entry
}

export interface FoodSources {
  products: Product[]
  overrides: ProductOverride[]
  blsPrefs: BlsPref[]
  /** jüngste Einträge (für „Zuletzt gegessen“) */
  recent: Entry[]
}

/** Wie viele jüngste Einträge für „Zuletzt gegessen“ durchgesehen werden */
const RECENT_SCAN = 300

export async function loadFoodSources(): Promise<FoodSources> {
  const [products, overrides, blsPrefs, recent] = await Promise.all([
    db.products.filter((p) => p.deletedAt === null).toArray(),
    db.productOverrides.filter((o) => o.deletedAt === null).toArray(),
    db.blsPrefs.filter((b) => b.deletedAt === null).toArray(),
    db.entries.orderBy('updatedAt').reverse().limit(RECENT_SCAN).toArray(),
  ])
  return { products, overrides, blsPrefs, recent }
}
