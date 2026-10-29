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

/** Datenbank im Stand von Version 3, mit Wasser-Feldern */
async function createV3() {
  const old = new Dexie(NAME)
  old.version(3).stores(SCHEMA_V1)
  const cola = { name: 'Cola', isDrink: true, countsAsWater: true, per100: { kcal: 42, water: 89.4 } }
  await old.table('products').add({ id: 'p1', ...sync, ...cola })
  await old.table('productOverrides').add({ id: 'o1', ...sync, productRef: 'product:p1', per100: { kcal: 40, water: 90 } })
  const pref = { blsCode: 'N110000', portions: [], isDrink: true, countsAsWater: null, useOverride: true }
  await old.table('blsPrefs').add({ id: 'b1', ...sync, ...pref })
  const entry = { date: '2026-10-01', nutrients: { kcal: 210, water: 447 }, waterMl: 447 }
  await old.table('entries').add({ id: 'e1', ...sync, ...entry })
  await old.table('profileVersions').add({ id: 'v1', ...sync, profileId: 'x', weeklyKcal: 14000, waterMl: null })
  await old.table('settings').add({ id: 's1', ...sync, key: 'waterEnabled', value: true })
  await old.table('settings').add({ id: 's2', ...sync, key: 'theme', value: 'dark' })
  old.close()
}

async function openCurrent() {
  const db = new Dexie(NAME)
  defineVersions(db)
  await db.open()
  return db
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

    expect(db.verno).toBe(6)
    expect(await db.table('products').get('p1')).toMatchObject({ per100: { kcal: 42 } })
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
    expect(db.verno).toBe(6)
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

describe('Datenbank-Version 4', () => {
  it('entfernt Wasser-Felder und den Nährwert water, updatedAt bleibt', async () => {
    await createV3()
    const db = await openCurrent()
    expect(await db.table('products').get('p1')).toEqual({ id: 'p1', ...sync, name: 'Cola', per100: { kcal: 42 }, price: null })
    expect((await db.table('productOverrides').get('o1')).per100).toEqual({ kcal: 40 })
    expect(await db.table('blsPrefs').get('b1')).toEqual({
      id: 'b1',
      ...sync,
      blsCode: 'N110000',
      portions: [],
      useOverride: true,
      price: null,
    })
    expect(await db.table('entries').get('e1')).toEqual({ id: 'e1', ...sync, date: '2026-10-01', nutrients: { kcal: 210 }, cost: null })
    expect(await db.table('profileVersions').get('v1')).toEqual({ id: 'v1', ...sync, profileId: 'x', weeklyKcal: 14000 })
    db.close()
  })

  it('Einstellung „Wasser tracken“ bekommt einen Löschmarker, andere bleiben', async () => {
    await createV3()
    const db = await openCurrent()
    const water = await db.table('settings').get('s1')
    expect(water.deletedAt).not.toBeNull()
    expect(water.updatedAt).toBe(water.deletedAt)
    expect(await db.table('settings').get('s2')).toMatchObject({ deletedAt: null, updatedAt: T0 })
    db.close()
  })
})

describe('Datenbank-Version 5', () => {
  it('Korrekturen bekommen unit = null, updatedAt und andere Felder bleiben', async () => {
    const old = new Dexie(NAME)
    old.version(4).stores(SCHEMA_V1)
    await old.table('productOverrides').add({ id: 'o1', ...sync, productRef: 'bls:N110000', per100: { kcal: 64 }, verifiedAt: null, note: null })
    await old.table('productOverrides').add({ id: 'o2', ...sync, productRef: 'product:p1', per100: {}, verifiedAt: T0, note: null, unit: 'ml' })
    old.close()
    const db = await openCurrent()
    expect(await db.table('productOverrides').get('o1')).toEqual({
      id: 'o1',
      ...sync,
      productRef: 'bls:N110000',
      per100: { kcal: 64 },
      verifiedAt: null,
      note: null,
      unit: null,
    })
    expect((await db.table('productOverrides').get('o2')).unit).toBe('ml')
    db.close()
  })
})

describe('Datenbank-Version 6', () => {
  it('Produkte und BLS bekommen price = null, Einträge cost = null; updatedAt und vorhandene Werte bleiben', async () => {
    const old = new Dexie(NAME)
    old.version(5).stores(SCHEMA_V1)
    await old.table('products').add({ id: 'p1', ...sync, name: 'Skyr' })
    await old.table('products').add({ id: 'p2', ...sync, name: 'Hafer', price: { amount: 0.89, per: 500 } })
    await old.table('blsPrefs').add({ id: 'b1', ...sync, blsCode: 'F503100', portions: [], useOverride: true })
    await old.table('entries').add({ id: 'e1', ...sync, date: '2026-10-01', kind: 'quick' })
    await old.table('settings').add({ id: 's1', ...sync, key: 'theme', value: 'dark' })
    old.close()
    const db = await openCurrent()
    expect(await db.table('products').get('p1')).toEqual({ id: 'p1', ...sync, name: 'Skyr', price: null })
    expect((await db.table('products').get('p2')).price).toEqual({ amount: 0.89, per: 500 })
    expect(await db.table('blsPrefs').get('b1')).toMatchObject({ price: null, updatedAt: T0 })
    expect(await db.table('entries').get('e1')).toMatchObject({ cost: null, updatedAt: T0 })
    expect(await db.table('settings').get('s1')).not.toHaveProperty('price')
    db.close()
  })
})
