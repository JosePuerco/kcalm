// Ersteinrichtung: Slots, erstes Profil und Optionen werden am Ende in einem Rutsch gespeichert,
// damit ein Abbruch keine halbe Einrichtung hinterlässt.

import { toLocalDate } from '../logic/dates.ts'
import type { ProfileFormData } from '../logic/profileForm.ts'
import { switchFromToday } from '../logic/profiles.ts'
import { db } from './db.ts'
import { assignVersion, createProfile } from './profiles.ts'
import { getSetting, setSetting } from './settings.ts'
import { saveSlots, type SlotData } from './slots.ts'

export const SETUP_DONE_KEY = 'setupDoneAt'
export const WATER_KEY = 'waterEnabled'
export const ESTIMATE_KEY = 'estimateEnabled'

/** Eingerichtet, wenn der Merker gesetzt ist oder (Backup vor Phase 3) schon ein Profil zugewiesen ist */
export async function isSetupDone(): Promise<boolean> {
  if ((await getSetting(SETUP_DONE_KEY)) !== undefined) return true
  return (await db.profileAssignments.filter((a) => a.deletedAt === null).count()) > 0
}

export interface SetupData {
  slots: readonly SlotData[]
  profile: ProfileFormData
  water: boolean
  estimate: boolean
}

export async function completeSetup(data: SetupData, now = new Date()): Promise<void> {
  const today = toLocalDate(now)
  await db.transaction(
    'rw',
    [db.slots, db.entries, db.profiles, db.profileVersions, db.profileAssignments, db.settings],
    async () => {
      await saveSlots(data.slots, now)
      const { version } = await createProfile(data.profile, now)
      // Mitten in der Woche: nur der Rest der Woche bekommt Budget, sonst wäre das Tagesziel zu hoch.
      // Vortage gehören zu keinem Profil, daher Verbrauch davor 0 (sie zählen auch später nicht, countFrom)
      await assignVersion(version.id, switchFromToday(today, version.weeklyKcal, 0), now)
      await setSetting(WATER_KEY, data.water, now)
      await setSetting(ESTIMATE_KEY, data.estimate, now)
      await setSetting(SETUP_DONE_KEY, now.toISOString(), now)
    },
  )
}
