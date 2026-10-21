import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import { dynamicTargetFor } from '../logic/goals.ts'
import { goalFor } from '../logic/profiles.ts'
import { DEFAULT_SLOTS } from '../logic/slots.ts'
import { db } from './db.ts'
import { assignVersion, createProfile, weekKcalBefore } from './profiles.ts'
import { newRecord, unknownNutrients } from './records.ts'
import { getSetting } from './settings.ts'
import { ESTIMATE_KEY, SETUP_DONE_KEY, WATER_KEY, completeSetup, isSetupDone } from './setup.ts'
import { getSlots, saveSlots } from './slots.ts'
import type { Entry } from './types.ts'

// Donnerstag, 22.10.2026, mittags (lokale Zeit)
const thursday = new Date(2026, 9, 22, 12, 0)
const later = new Date(2026, 9, 22, 13, 0)

const profile = {
  name: 'Aufbau',
  weeklyKcal: 19600,
  protein: { mode: 'gPerKg' as const, value: 1.8 },
  fat: { mode: 'percent' as const, value: 25 },
  carbs: { mode: 'rest' as const, value: null },
  fiberG: 30,
  waterMl: null,
  manualWeightKg: 74,
}

const defaults = DEFAULT_SLOTS.map((s) => ({ name: s.name, timeFrom: s.timeFrom, timeTo: s.timeTo }))

function entry(date: string, slotId: string, kcal: number | null) {
  return newRecord<Entry>({
    date,
    slotId,
    kind: 'quick',
    ref: null,
    nameSnapshot: 'Test',
    amount: null,
    unit: null,
    portionLabel: null,
    nutrients: { ...unknownNutrients(), kcal },
    waterMl: 0,
    mealGroupId: null,
    mealName: null,
  })
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('saveSlots', () => {
  it('legt Slots in Listenreihenfolge an', async () => {
    await saveSlots(defaults, thursday)
    const slots = await getSlots()
    expect(slots.map((s) => [s.name, s.order])).toEqual([
      ['Frühstück', 0],
      ['Mittag', 1],
      ['Snacks', 2],
      ['Abend', 3],
    ])
  })

  it('ändert vorhandene Slots über ihre id, Reihenfolge neu', async () => {
    const [a, b] = await saveSlots(defaults.slice(0, 2), thursday)
    await saveSlots([{ ...b!, name: 'Lunch' }, a!], later)
    const slots = await getSlots()
    expect(slots.map((s) => s.name)).toEqual(['Lunch', 'Frühstück'])
    expect(slots[0]?.id).toBe(b!.id)
    expect(slots[0]?.updatedAt).toBe(later.toISOString())
  })

  it('entfernt unbenutzte Slots per Löschmarker, benutzte werden archiviert', async () => {
    const [used, unused, keep] = await saveSlots(defaults.slice(0, 3), thursday)
    await db.entries.add(entry('2026-10-20', used!.id, 300))
    await saveSlots([keep!], later)
    expect((await getSlots()).map((s) => s.id)).toEqual([keep!.id])
    expect(await db.slots.get(used!.id)).toMatchObject({ archived: true, deletedAt: null })
    expect((await db.slots.get(unused!.id))?.deletedAt).toBe(later.toISOString())
  })

  it('gelöschte Einträge machen einen Slot nicht „benutzt“', async () => {
    const [slot] = await saveSlots(defaults.slice(0, 1), thursday)
    await db.entries.add({ ...entry('2026-10-20', slot!.id, 300), deletedAt: thursday.toISOString() })
    await saveSlots([], later)
    expect((await db.slots.get(slot!.id))?.deletedAt).not.toBeNull()
  })
})

describe('Profile', () => {
  it('createProfile legt Profil und erste Version an', async () => {
    const { profile: p, version } = await createProfile(profile, thursday)
    expect(await db.profiles.get(p.id)).toMatchObject({ name: 'Aufbau', archived: false })
    expect(await db.profileVersions.get(version.id)).toMatchObject({ profileId: p.id, weeklyKcal: 19600 })
    expect(version).not.toHaveProperty('name')
  })

  it('weekKcalBefore: nur Vortage dieser Woche, bekannte kcal, ohne gelöschte', async () => {
    await db.entries.bulkAdd([
      entry('2026-10-18', 's', 5000), // Sonntag der Vorwoche
      entry('2026-10-19', 's', 2950),
      entry('2026-10-20', 's', 3100),
      entry('2026-10-21', 's', 2850),
      entry('2026-10-21', 's', null),
      { ...entry('2026-10-21', 's', 999), deletedAt: thursday.toISOString() },
      entry('2026-10-22', 's', 1000), // heute
    ])
    expect(await weekKcalBefore('2026-10-22')).toBe(8900)
    expect(await weekKcalBefore('2026-10-19')).toBe(0)
  })

  it('assignVersion speichert den Plan', async () => {
    const { version } = await createProfile(profile, thursday)
    const a = await assignVersion(version.id, { validFrom: '2026-10-26', weekBudgetOverride: null }, thursday)
    expect(await db.profileAssignments.get(a.id)).toMatchObject({ validFrom: '2026-10-26', profileVersionId: version.id })
  })
})

describe('completeSetup', () => {
  it('speichert alles; Start am Donnerstag ergibt trotzdem 2.800 / Tag', async () => {
    expect(await isSetupDone()).toBe(false)
    await completeSetup({ slots: defaults, profile, water: true, estimate: false }, thursday)

    expect(await isSetupDone()).toBe(true)
    expect(await getSetting(SETUP_DONE_KEY)).toBe(thursday.toISOString())
    expect(await getSetting(WATER_KEY)).toBe(true)
    expect(await getSetting(ESTIMATE_KEY)).toBe(false)
    expect(await getSlots()).toHaveLength(4)

    const goal = goalFor(await db.profileAssignments.toArray(), await db.profileVersions.toArray(), '2026-10-22')
    // 19.600 × 4 ÷ 7 = 11.200 für Do–So
    expect(goal?.weekBudget).toBe(11200)
    expect(dynamicTargetFor('2026-10-22', '2026-10-22', {}, goal!.weekBudget)).toBe(2800)
    // Vor dem Start gibt es kein Ziel, ab nächster Woche das volle Budget
    expect(goalFor(await db.profileAssignments.toArray(), await db.profileVersions.toArray(), '2026-10-21')).toBeNull()
    expect(goalFor(await db.profileAssignments.toArray(), await db.profileVersions.toArray(), '2026-10-26')?.weekBudget).toBe(19600)
  })

  it('Start am Montag: kein Override', async () => {
    await completeSetup({ slots: defaults, profile, water: false, estimate: false }, new Date(2026, 9, 19, 9))
    expect((await db.profileAssignments.toArray())[0]?.weekBudgetOverride).toBeNull()
  })

  it('schlägt etwas fehl, bleibt nichts halb gespeichert', async () => {
    // Fehler erst beim letzten Schritt (Einstellungen), wenn Slots und Profil schon geschrieben sind
    const fail = () => {
      throw new Error('Speicher voll')
    }
    db.settings.hook('creating', fail)
    try {
      await expect(completeSetup({ slots: defaults, profile, water: true, estimate: false }, thursday)).rejects.toThrow()
    } finally {
      db.settings.hook('creating').unsubscribe(fail)
    }
    expect(await db.slots.count()).toBe(0)
    expect(await db.profiles.count()).toBe(0)
    expect(await isSetupDone()).toBe(false)
  })

  it('Backup vor Phase 3 mit zugewiesenem Profil gilt als eingerichtet', async () => {
    const { version } = await createProfile(profile, thursday)
    await assignVersion(version.id, { validFrom: '2026-10-19', weekBudgetOverride: null }, thursday)
    expect(await isSetupDone()).toBe(true)
  })
})
