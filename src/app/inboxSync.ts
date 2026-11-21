// Vorschläge und Gewicht aus Fitboard abholen (Phase 16, 16.2): beim Start, wenn das Netz zurückkommt und beim
// Zurückkehren in die App, wie die gemerkten Scans. Nur mit eingeschaltetem Schalter; Fehler stehen still im
// Push-Screen. Ein Fehler beim einen hält das andere nicht auf.

import { useEffect } from 'react'
import { fetchWeights } from '../db/garminWeights.ts'
import { fetchInbox } from '../db/inbox.ts'
import { getPushStorage, refreshPushView } from './pushSync.ts'

let running = false

/** Abholen anstoßen; läuft schon eins, passiert nichts. Wirft nie. */
export async function runInboxFetch(): Promise<void> {
  if (running) return
  running = true
  try {
    try {
      await fetchInbox(getPushStorage())
    } catch (error) {
      console.error('Vorschläge abholen fehlgeschlagen', error)
    }
    try {
      await fetchWeights(getPushStorage())
    } catch (error) {
      console.error('Gewicht abholen fehlgeschlagen', error)
    }
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
