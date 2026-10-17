// Hell/Dunkel: Standard folgt dem System, manuell über data-theme am <html>.
// Die Farben selbst kommen aus tokens.css; hier wird nur umgeschaltet.
// Die Wahl wird in der settings-Tabelle gespeichert (Schlüssel „theme“).
import { useSyncExternalStore } from 'react'
import tokens from '../../design/tokens.json'
import { getSetting, setSetting } from '../db/settings.ts'

export type ThemePref = 'system' | 'light' | 'dark'

let pref: ThemePref = 'system'
const listeners = new Set<() => void>()
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

function isDark(): boolean {
  return pref === 'dark' || (pref === 'system' && darkQuery().matches)
}

/** Statusleiste in iOS an den Hintergrund anpassen */
function updateThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', isDark() ? tokens.color.dark.bg : tokens.color.light.bg)
}

function apply() {
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref
  updateThemeColor()
}

/** Startet die Theme-Steuerung; gibt eine Aufräumfunktion zurück (für useEffect) */
export function initTheme() {
  const query = darkQuery()
  query.addEventListener('change', updateThemeColor)
  apply()
  getSetting<ThemePref>('theme').then(
    (saved) => {
      if (saved === 'light' || saved === 'dark') change(saved)
    },
    (error: unknown) => console.error('Theme nicht lesbar', error),
  )
  return () => query.removeEventListener('change', updateThemeColor)
}

function change(next: ThemePref) {
  pref = next
  apply()
  listeners.forEach((l) => l())
}

export function setThemePref(next: ThemePref) {
  change(next)
  setSetting('theme', next).catch((error: unknown) => console.error('Theme nicht gespeichert', error))
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => pref,
  )
}
