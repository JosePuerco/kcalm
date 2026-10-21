// Profile, Versionen und Zuweisungen speichern. Eine Version wird nie geändert:
// Bearbeiten legt eine neue an, damit vergangene Tage ihre damaligen Ziele behalten.

import { weekStart } from '../logic/dates.ts'
import type { ProfileFormData } from '../logic/profileForm.ts'
import {
  latestVersion,
  profileStatus,
  switchFromNextMonday,
  switchFromToday,
  targetsChanged,
  type PlannedSwitch,
} from '../logic/profiles.ts'
import { db } from './db.ts'
import { newRecord, softDelete, touch } from './records.ts'
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

/**
 * Verbrauch der Vortage dieser Woche (bekannte kcal), Grundlage für „ab heute“.
 * Tage vor dem allerersten Profil zählen nicht (sie gehören zu keinem Budget).
 */
export async function weekKcalBefore(date: LocalDate): Promise<number> {
  const firstStart = (await db.profileAssignments.filter((a) => a.deletedAt === null).toArray())
    .map((a) => a.validFrom)
    .sort()[0]
  const monday = weekStart(date)
  const from = firstStart && firstStart > monday ? firstStart : monday
  if (from >= date) return 0
  const entries = await db.entries.where('date').between(from, date, true, false).toArray()
  return entries.reduce((sum, e) => (e.deletedAt === null ? sum + (e.nutrients.kcal ?? 0) : sum), 0)
}

export interface ProfilesData {
  profiles: Profile[]
  versions: ProfileVersion[]
  assignments: ProfileAssignment[]
}

export async function loadProfiles(): Promise<ProfilesData> {
  const [profiles, versions, assignments] = await Promise.all([
    db.profiles.filter((p) => p.deletedAt === null && !p.archived).toArray(),
    db.profileVersions.filter((v) => v.deletedAt === null).toArray(),
    db.profileAssignments.filter((a) => a.deletedAt === null).toArray(),
  ])
  profiles.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return { profiles, versions, assignments }
}

const TABLES = [db.profiles, db.profileVersions, db.profileAssignments, db.entries]

/**
 * Profil sichern.
 * - Name geändert: nur umbenennen.
 * - Ziele geändert: neue Version. Ist das Profil heute aktiv, gilt sie ab heute (Wochenrest anteilig wie
 *   „ab heute“); geplante Wechsel auf dieses Profil zeigen danach auf die neue Version.
 */
export async function saveProfile(profileId: string, data: ProfileFormData, today: LocalDate, now = new Date()): Promise<void> {
  const { name, ...target } = data
  await db.transaction('rw', TABLES, async () => {
    const profile = await db.profiles.get(profileId)
    if (!profile || profile.deletedAt !== null) throw new Error(`Profil ${profileId} nicht gefunden`)
    if (profile.name !== name) await db.profiles.put(touch(profile, { name }, now))

    const { versions, assignments } = await loadProfiles()
    const current = latestVersion(versions, profileId)
    if (current && !targetsChanged(current, target)) return

    const version = newRecord<ProfileVersion>({ ...target, profileId }, now)
    await db.profileVersions.add(version)
    const ownVersions = new Set(versions.filter((v) => v.profileId === profileId).map((v) => v.id))

    if (profileStatus(assignments, versions, today).activeProfileId === profileId) {
      await assignVersion(version.id, switchFromToday(today, version.weeklyKcal, await weekKcalBefore(today)), now)
    }
    // Noch nicht begonnene Zuweisungen dürfen umziehen; begonnene bleiben für die Historie
    for (const a of assignments) {
      if (a.validFrom > today && ownVersions.has(a.profileVersionId)) {
        await db.profileAssignments.put(touch(a, { profileVersionId: version.id }, now))
      }
    }
  })
}

export type ActivateMode = 'nextMonday' | 'today'

/** Anderes Profil aktivieren; ersetzt einen bereits geplanten Wechsel */
export async function activateProfile(profileId: string, mode: ActivateMode, today: LocalDate, now = new Date()): Promise<ProfileAssignment> {
  return db.transaction('rw', TABLES, async () => {
    const { versions, assignments } = await loadProfiles()
    const version = latestVersion(versions, profileId)
    if (!version) throw new Error(`Profil ${profileId} hat keine Version`)
    for (const a of assignments) if (a.validFrom > today) await db.profileAssignments.put(softDelete(a, now))
    const plan = mode === 'nextMonday' ? switchFromNextMonday(today) : switchFromToday(today, version.weeklyKcal, await weekKcalBefore(today))
    return assignVersion(version.id, plan, now)
  })
}

/** Geplanten Wechsel zurücknehmen */
export async function cancelScheduled(assignmentId: string, now = new Date()): Promise<void> {
  await db.transaction('rw', db.profileAssignments, async () => {
    const a = await db.profileAssignments.get(assignmentId)
    if (a && a.deletedAt === null) await db.profileAssignments.put(softDelete(a, now))
  })
}
