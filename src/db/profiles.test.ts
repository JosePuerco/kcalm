import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import { dynamicTargetFor } from '../logic/goals.ts'
import { goalFor, latestVersion, profileStatus } from '../logic/profiles.ts'
import { db } from './db.ts'
import { activateProfile, assignVersion, cancelScheduled, createProfile, loadProfiles, saveProfile, weekKcalBefore } from './profiles.ts'
import { newRecord, unknownNutrients } from './records.ts'
import type { Entry } from './types.ts'

const t0 = new Date('2026-09-01T08:00:00.000Z')
const t1 = new Date('2026-10-22T09:00:00.000Z')
const t2 = new Date('2026-10-22T10:00:00.000Z')
const thursday = '2026-10-22'

const aufbau = {
  name: 'Aufbau',
  weeklyKcal: 19600,
  protein: { mode: 'gPerKg' as const, value: 1.8 },
  fat: { mode: 'percent' as const, value: 25 },
  carbs: { mode: 'rest' as const, value: null },
  fiberG: 30,
  waterMl: null,
  manualWeightKg: 74,
}
const diaet = { ...aufbau, name: 'Diät', weeklyKcal: 15400, protein: { mode: 'gPerKg' as const, value: 2.2 } }

function entry(date: string, kcal: number) {
  return newRecord<Entry>({
    date,
    slotId: 's',
    kind: 'quick',
    ref: null,
    nameSnapshot: 'x',
    amount: null,
    unit: null,
    portionLabel: null,
    nutrients: { ...unknownNutrients(), kcal },
    waterMl: 0,
    mealGroupId: null,
    mealName: null,
  })
}

/** Aufbau seit 01.09., Diät angelegt, Mo–Mi 8.900 kcal */
async function setup() {
  const a = await createProfile(aufbau, t0)
  await assignVersion(a.version.id, { validFrom: '2026-09-01', weekBudgetOverride: null }, t0)
  const d = await createProfile(diaet, t0)
  await db.entries.bulkAdd([entry('2026-10-19', 2950), entry('2026-10-20', 3100), entry('2026-10-21', 2850)])
  return { aufbau: a.profile.id, diaet: d.profile.id }
}

async function goalOn(date: string) {
  const { versions, assignments } = await loadProfiles()
  return goalFor(assignments, versions, date)
}

async function status(today = thursday) {
  const { versions, assignments } = await loadProfiles()
  return profileStatus(assignments, versions, today)
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('activateProfile', () => {
  it('PLAN.md: Wechsel Do auf Diät „ab heute“ → Woche 17.700, Do–So je 2.200', async () => {
    const ids = await setup()
    await activateProfile(ids.diaet, 'today', thursday, t1)
    const goal = await goalOn(thursday)
    expect(goal?.weekBudget).toBe(17700)
    const kcal = { '2026-10-19': 2950, '2026-10-20': 3100, '2026-10-21': 2850 }
    expect(dynamicTargetFor(thursday, thursday, kcal, goal!.weekBudget)).toBeCloseTo(2200, 10)
    // Mi behält Aufbau, nächste Woche das volle Diät-Budget
    expect((await goalOn('2026-10-21'))?.weekBudget).toBe(19600)
    expect((await goalOn('2026-10-26'))?.weekBudget).toBe(15400)
    expect((await status()).activeProfileId).toBe(ids.diaet)
  })

  it('„ab nächstem Montag“: diese Woche bleibt, geplant ab 26.10.', async () => {
    const ids = await setup()
    await activateProfile(ids.diaet, 'nextMonday', thursday, t1)
    expect((await goalOn(thursday))?.weekBudget).toBe(19600)
    expect((await goalOn('2026-10-26'))?.weekBudget).toBe(15400)
    const s = await status()
    expect(s.activeProfileId).toBe(ids.aufbau)
    expect(s.scheduled).toMatchObject({ validFrom: '2026-10-26', profileId: ids.diaet })
  })

  it('ersetzt einen schon geplanten Wechsel; Zurücknehmen löscht ihn', async () => {
    const ids = await setup()
    await activateProfile(ids.diaet, 'nextMonday', thursday, t1)
    const again = await activateProfile(ids.diaet, 'nextMonday', thursday, t2)
    expect((await loadProfiles()).assignments.filter((a) => a.validFrom > thursday)).toHaveLength(1)
    await cancelScheduled(again.id, t2)
    expect((await status()).scheduled).toBeNull()
    expect((await goalOn('2026-10-26'))?.weekBudget).toBe(19600)
  })
})

describe('saveProfile', () => {
  it('nur umbenennen: keine neue Version, keine Zuweisung', async () => {
    const ids = await setup()
    await saveProfile(ids.aufbau, { ...aufbau, name: 'Masse' }, thursday, t1)
    const data = await loadProfiles()
    expect(data.profiles.find((p) => p.id === ids.aufbau)?.name).toBe('Masse')
    expect(data.versions.filter((v) => v.profileId === ids.aufbau)).toHaveLength(1)
    expect(data.assignments).toHaveLength(1)
  })

  it('aktives Profil: neue Version ab heute, anteilig; alte Tage behalten die alte Version', async () => {
    const ids = await setup()
    await saveProfile(ids.aufbau, { ...aufbau, weeklyKcal: 18200 }, thursday, t1)
    // 18.200 × 4 ÷ 7 + 8.900 = 19.300
    expect((await goalOn(thursday))?.weekBudget).toBe(19300)
    expect((await goalOn('2026-10-21'))?.version.weeklyKcal).toBe(19600)
    expect((await goalOn('2026-10-26'))?.weekBudget).toBe(18200)
    expect((await status()).activeSince).toBe('2026-09-01')
  })

  it('inaktives Profil: neue Version ohne Zuweisung; geplanter Wechsel zieht auf die neue Version um', async () => {
    const ids = await setup()
    await activateProfile(ids.diaet, 'nextMonday', thursday, t1)
    await saveProfile(ids.diaet, { ...diaet, weeklyKcal: 14000 }, thursday, t2)
    const data = await loadProfiles()
    expect(latestVersion(data.versions, ids.diaet)?.weeklyKcal).toBe(14000)
    expect((await goalOn('2026-10-26'))?.weekBudget).toBe(14000)
    expect(data.assignments).toHaveLength(2)
  })
})

describe('weekKcalBefore', () => {
  it('Tage vor dem ersten Profil zählen nicht', async () => {
    const p = await createProfile(aufbau, t0)
    await assignVersion(p.version.id, { validFrom: '2026-10-21', weekBudgetOverride: 14000 }, t0)
    await db.entries.bulkAdd([entry('2026-10-19', 2950), entry('2026-10-21', 2850)])
    expect(await weekKcalBefore(thursday)).toBe(2850)
    expect(await weekKcalBefore('2026-10-21')).toBe(0)
  })
})
