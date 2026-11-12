// Server-Push anstoßen (Phase 14e): beim Start, beim Zurückkehren in die App, wenn das Netz zurückkommt und
// 3 s nach dem Speichern (gebündelt). Kein Hintergrund-Sync, das geht in iOS-PWAs nicht.
// Fehler beim automatischen Push sind still: Sie stehen nur im Status in den Einstellungen.

import { Dexie } from 'dexie'
import { useEffect, useSyncExternalStore } from 'react'
import { db } from '../db/db.ts'
import { useLiveQuery } from '../db/live.ts'
import { browserPushStorage, pendingPushCount, pushNow, type PushOutcome } from '../db/push.ts'
import { isPushRelevantChange, PUSH_DEBOUNCE_MS, type PushConfig, type PushState } from '../logic/push.ts'

export interface PushView {
  config: PushConfig
  state: PushState
  running: boolean
}

const storage = browserPushStorage()
let view: PushView = { config: storage.loadConfig(), state: storage.loadState(), running: false }
const listeners = new Set<() => void>()

function set(next: Partial<PushView>) {
  view = { ...view, ...next }
  for (const l of listeners) l()
}

const refresh = () => set({ config: storage.loadConfig(), state: storage.loadState() })

export function getPushStorage() {
  return storage
}

/** Push anstoßen; Ergebnis für „Jetzt übertragen“. Wirft nie. */
export async function runPush(): Promise<PushOutcome | null> {
  set({ running: true })
  try {
    return await pushNow(storage)
  } catch (error) {
    // Datenbankfehler o. Ä.: nichts quittiert, beim nächsten Auslöser erneut
    console.error('Push fehlgeschlagen', error)
    return null
  } finally {
    set({ running: false })
    refresh()
  }
}

/** Einstellungen speichern und, falls an, gleich übertragen */
export function savePushConfig(config: PushConfig): void {
  storage.saveConfig(config)
  refresh()
  if (config.enabled) void runPush()
}

export function usePushView(): PushView {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => view,
  )
}

/** Anzahl ausstehender Änderungen, aktualisiert sich mit der Datenbank; bei ausgeschaltetem Push 0 */
export function usePendingPushCount(current: PushView): number | undefined {
  return useLiveQuery(
    () => (current.config.enabled ? pendingPushCount(storage) : Promise.resolve(0)),
    [current.config, current.state],
  )
}

/** Einmal in der App-Hülle */
export function usePushTriggers() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const run = () => {
      if (!storage.loadConfig().enabled) return
      void runPush()
    }
    const later = () => {
      clearTimeout(timer)
      timer = setTimeout(run, PUSH_DEBOUNCE_MS)
    }
    const onVisible = () => document.visibilityState === 'visible' && run()
    const onMutated = (parts: Record<string, unknown>) => {
      if (isPushRelevantChange(Object.keys(parts), db.name)) later()
    }

    run()
    window.addEventListener('online', run)
    document.addEventListener('visibilitychange', onVisible)
    Dexie.on('storagemutated', onMutated)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('online', run)
      document.removeEventListener('visibilitychange', onVisible)
      Dexie.on.storagemutated.unsubscribe(onMutated)
    }
  }, [])
}
