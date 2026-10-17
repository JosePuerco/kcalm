// Hell/Dunkel: Standard folgt dem System, manuell über data-theme am <html>.
// Die Farben selbst kommen aus tokens.css; hier wird nur umgeschaltet.
// Gespeichert wird die Wahl erst ab Phase 1 (settings-Tabelle).
import { useSyncExternalStore } from 'react'
import tokens from '../../design/tokens.json'

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
  return () => query.removeEventListener('change', updateThemeColor)
}

export function setThemePref(next: ThemePref) {
  pref = next
  apply()
  listeners.forEach((l) => l())
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
