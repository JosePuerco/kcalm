// Gemerkte Scans im Hintergrund nachladen: beim Start, wenn das Netz zurückkommt und beim Zurückkehren
// in die App. Treffer landen in der Datenbank; „nicht gefunden“ / „ohne kcal“ merkt sich nur diese Sitzung
// (kein neues Feld im Datenmodell, beim nächsten Start wird einfach erneut gefragt).
import { useEffect, useSyncExternalStore } from 'react'
import { syncPendingScans, type SyncOutcome } from '../db/pendingScans.ts'

type State = { running: boolean; outcomes: ReadonlyMap<string, SyncOutcome> }

let state: State = { running: false, outcomes: new Map() }
const listeners = new Set<() => void>()

function set(next: Partial<State>) {
  state = { ...state, ...next }
  for (const l of listeners) l()
}

/** Nachladen anstoßen; läuft schon eins, passiert nichts */
export async function runPendingSync(): Promise<void> {
  if (state.running) return
  set({ running: true })
  try {
    const outcomes = await syncPendingScans()
    set({ outcomes: new Map([...state.outcomes, ...outcomes]) })
  } catch (error) {
    console.error(error)
  } finally {
    set({ running: false })
  }
}

export function usePendingSync(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

/** Einmal in der App-Hülle: stößt das Nachladen zu den passenden Zeitpunkten an */
export function usePendingSyncTriggers() {
  useEffect(() => {
    const run = () => void runPendingSync()
    const onVisible = () => document.visibilityState === 'visible' && run()
    run()
    window.addEventListener('online', run)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', run)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
}
