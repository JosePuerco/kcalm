import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden
import { Dexie } from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { SCHEMA_V1 } from './schema.ts'
import { defineVersions } from './versions.ts'

const NAME = 'kcalm-versions-test'
const T0 = '2026-10-01T10:00:00.000Z'
const sync = { createdAt: T0, updatedAt: T0, deletedAt: null }

/** Datenbank im Stand von Version 1, mit Nährwert „alcohol“ */
async function createV1() {
  const old = new Dexie(NAME)
  old.version(1).stores(SCHEMA_V1)
  await old.table('products').add({ id: 'p1', ...sync, name: 'Bier', per100: { kcal: 42, water: 92, alcohol: 3.9 } })
  await old.table('productOverrides').add({ id: 'o1', ...sync, productRef: 'product:p1', per100: { alcohol: 4 } })
  await old.table('entries').add({ id: 'e1', ...sync, date: '2026-10-01', nutrients: { kcal: 210, alcohol: 19.5 } })
  await old.table('settings').add({ id: 's1', ...sync, key: 'theme', value: { alcohol: 'bleibt' } })
  await old.table('blsPrefs').add({ id: 'b1', ...sync, blsCode: 'F503100', portions: [], isDrink: null, countsAsWater: null })
  old.close()
}

afterEach(async () => {
  await Dexie.delete(NAME)
})

describe('Datenbank-Version 2', () => {
  it('entfernt alcohol aus Produkten, Korrekturen und Einträgen', async () => {
    await createV1()
    const db = new Dexie(NAME)
    defineVersions(db)
    await db.open()

    expect(db.verno).toBe(3)
    expect(await db.table('products').get('p1')).toMatchObject({ per100: { kcal: 42, water: 92 } })
    expect((await db.table('products').get('p1')).per100).not.toHaveProperty('alcohol')
    expect((await db.table('productOverrides').get('o1')).per100).toEqual({})
    expect((await db.table('entries').get('e1')).nutrients).toEqual({ kcal: 210 })
    db.close()
  })

  it('ändert updatedAt und fremde Felder nicht', async () => {
    await createV1()
    const db = new Dexie(NAME)
    defineVersions(db)
    await db.open()

    expect((await db.table('products').get('p1')).updatedAt).toBe(T0)
    expect((await db.table('settings').get('s1')).value).toEqual({ alcohol: 'bleibt' })
    db.close()
  })

  it('neue Datenbank startet direkt in der neuesten Version', async () => {
    const db = new Dexie(NAME)
    defineVersions(db)
    await db.open()
    expect(db.verno).toBe(3)
    db.close()
  })
})

describe('Datenbank-Version 3', () => {
  it('BLS-Einstellungen bekommen useOverride = true, updatedAt bleibt', async () => {
    await createV1()
    const db = new Dexie(NAME)
    defineVersions(db)
    await db.open()
    expect(await db.table('blsPrefs').get('b1')).toMatchObject({ useOverride: true, updatedAt: T0 })
    db.close()
  })
})
