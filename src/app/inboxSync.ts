// Vorschläge aus Fitboard abholen (Phase 16): beim Start, wenn das Netz zurückkommt und beim Zurückkehren in
// die App, wie die gemerkten Scans. Nur mit eingeschaltetem Schalter; Fehler stehen still im Push-Screen.

import { useEffect } from 'react'
import { fetchInbox } from '../db/inbox.ts'
import { getPushStorage, refreshPushView } from './pushSync.ts'

let running = false

/** Abholen anstoßen; läuft schon eins, passiert nichts. Wirft nie. */
export async function runInboxFetch(): Promise<void> {
  if (running) return
  running = true
  try {
    await fetchInbox(getPushStorage())
  } catch (error) {
    console.error('Vorschläge abholen fehlgeschlagen', error)
  } finally {
    running = false
    refreshPushView()
  }
}

/** Einmal in der App-Hülle */
export function useInboxTriggers() {
  useEffect(() => {
    const run = () => void runInboxFetch()
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
