// Profile, Versionen und Zuweisungen speichern. Eine Version wird nie geändert:
// Bearbeiten legt eine neue an, damit vergangene Tage ihre damaligen Ziele behalten.

import { weekStart } from '../logic/dates.ts'
import type { ProfileFormData } from '../logic/profileForm.ts'
import type { PlannedSwitch } from '../logic/profiles.ts'
import { db } from './db.ts'
import { newRecord } from './records.ts'
import type { LocalDate, Profile, ProfileAssignment, ProfileVersion } from './types.ts'

export async function createProfile(
  { name, ...target }: ProfileFormData,
  now = new Date(),
): Promise<{ profile: Profile; version: ProfileVersion }> {
  return db.transaction('rw', [db.profiles, db.profileVersions], async () => {
    const profile = newRecord<Profile>({ name, archived: false }, now)
    const version = newRecord<ProfileVersion>({ ...target, profileId: profile.id }, now)
    await db.profiles.add(profile)
    await db.profileVersions.add(version)
    return { profile, version }
  })
}

/** Version ab einem Datum gültig machen („ab nächstem Montag“ oder „ab heute“) */
export async function assignVersion(versionId: string, plan: PlannedSwitch, now = new Date()): Promise<ProfileAssignment> {
  const assignment = newRecord<ProfileAssignment>({ profileVersionId: versionId, ...plan }, now)
  await db.profileAssignments.add(assignment)
  return assignment
}

/** Verbrauch der Vortage dieser Woche (bekannte kcal), Grundlage für „ab heute“ */
export async function weekKcalBefore(date: LocalDate): Promise<number> {
  const entries = await db.entries.where('date').between(weekStart(date), date, true, false).toArray()
  return entries.reduce((sum, e) => (e.deletedAt === null ? sum + (e.nutrients.kcal ?? 0) : sum), 0)
}
