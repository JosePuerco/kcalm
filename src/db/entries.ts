// Tagebucheinträge speichern und die Quellen fürs Hinzufügen-Sheet laden.

import type { EntryChanges, NewEntryFields } from '../logic/addFood.ts'
import { copiedEntries } from '../logic/copyDay.ts'
import { db } from './db.ts'
import { newRecord, softDelete, touch } from './records.ts'
import type { BlsPref, Entry, LocalDate, Product, ProductOverride } from './types.ts'

export async function addEntry(fields: NewEntryFields, now = new Date()): Promise<Entry> {
  const entry = newRecord<Entry>(fields, now)
  await db.entries.add(entry)
  return entry
}

export async function getEntry(id: string): Promise<Entry> {
  const entry = await db.entries.get(id)
  if (!entry || entry.deletedAt !== null) throw new Error(`Eintrag ${id} nicht gefunden`)
  return entry
}

/** Menge, Slot oder Tag ändern (Verschieben), beim Schnelleintrag auch den Namen; updatedAt wird gesetzt */
export async function updateEntry(
  id: string,
  changes: EntryChanges & Partial<Pick<Entry, 'nameSnapshot'>>,
  now = new Date(),
): Promise<Entry> {
  return db.transaction('rw', db.entries, async () => {
    const updated = touch(await getEntry(id), changes, now)
    await db.entries.put(updated)
    return updated
  })
}

/** Löschen = Löschmarker setzen */
export async function deleteEntry(id: string, now = new Date()): Promise<void> {
  await db.transaction('rw', db.entries, async () => {
    await db.entries.put(softDelete(await getEntry(id), now))
  })
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

/** Nicht gelöschte Einträge eines Tages */
export async function getDayEntries(date: LocalDate): Promise<Entry[]> {
  return db.entries.where('date').equals(date).filter((e) => e.deletedAt === null).toArray()
}

/** Tag oder einen Slot in einen anderen Tag kopieren; liefert die neuen Einträge */
export async function copyEntries(
  sourceDate: LocalDate,
  targetDate: LocalDate,
  slotId?: string,
  now = new Date(),
): Promise<Entry[]> {
  if (sourceDate === targetDate) throw new Error('Quell- und Zieltag sind gleich')
  return db.transaction('rw', db.entries, async () => {
    const copies = copiedEntries(await getDayEntries(sourceDate), targetDate, { slotId }).map((fields) =>
      newRecord<Entry>(fields, now),
    )
    await db.entries.bulkAdd(copies)
    return copies
  })
}
