// Lokale Datenbank (IndexedDB über Dexie). Im Schema stehen nur die Indizes;
// alle anderen Felder werden trotzdem gespeichert.
// archived und deletedAt sind kein Index: IndexedDB kann nicht nach true/false oder null suchen.

import { Dexie, type EntityTable } from 'dexie'
import type {
  BlsPref,
  Day,
  Entry,
  Meal,
  PendingScan,
  Product,
  ProductOverride,
  Profile,
  ProfileAssignment,
  ProfileVersion,
  Recipe,
  Setting,
  Slot,
  Weight,
} from './types.ts'
import { defineVersions } from './versions.ts'

export const db = new Dexie('kcalm') as Dexie & {
  products: EntityTable<Product, 'id'>
  productOverrides: EntityTable<ProductOverride, 'id'>
  blsPrefs: EntityTable<BlsPref, 'id'>
  meals: EntityTable<Meal, 'id'>
  recipes: EntityTable<Recipe, 'id'>
  slots: EntityTable<Slot, 'id'>
  entries: EntityTable<Entry, 'id'>
  days: EntityTable<Day, 'id'>
  profiles: EntityTable<Profile, 'id'>
  profileVersions: EntityTable<ProfileVersion, 'id'>
  profileAssignments: EntityTable<ProfileAssignment, 'id'>
  weights: EntityTable<Weight, 'id'>
  pendingScans: EntityTable<PendingScan, 'id'>
  settings: EntityTable<Setting, 'id'>
}

defineVersions(db)
