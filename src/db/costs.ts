// Kostenauswertung (Phase 13): Schalter in den Einstellungen. Ausschalten löscht keine Preise.

import { getSetting, setSetting } from './settings.ts'

export const COSTS_KEY = 'costsEnabled'

export async function getCostsEnabled(): Promise<boolean> {
  return (await getSetting<boolean>(COSTS_KEY)) === true
}

export async function setCostsEnabled(enabled: boolean, now = new Date()): Promise<void> {
  await setSetting(COSTS_KEY, enabled, now)
}
