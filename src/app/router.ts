// Kleiner Hash-Router: #/statistik statt /statistik, damit GitHub Pages
// beim Neuladen keinen 404 liefert.
import { useMemo, useSyncExternalStore } from 'react'

export const routes = ['tagebuch', 'statistik', 'lebensmittel', 'einstellungen', 'vorschau'] as const
export type Route = (typeof routes)[number]

export function parseHash(hash: string): Route {
  const name = hash.replace(/^#\/?/, '').split(/[/?]/)[0] ?? ''
  return (routes as readonly string[]).includes(name) ? (name as Route) : 'tagebuch'
}

/** Teile nach dem Screen-Namen: „#/lebensmittel/produkt/abc“ → ['produkt', 'abc'] */
export function parseSubPath(hash: string): string[] {
  const [name, ...rest] = (hash.replace(/^#\/?/, '').split('?')[0] ?? '').split('/')
  // Unbekannter Screen fällt aufs Tagebuch zurück, dann gilt auch kein Unterpfad
  if (!(routes as readonly string[]).includes(name ?? '')) return []
  try {
    return rest.filter((part) => part !== '').map((part) => decodeURIComponent(part))
  } catch {
    return [] // kaputt kodierter Link
  }
}

export function href(route: Route, ...subPath: string[]): string {
  return ['#', route, ...subPath.map(encodeURIComponent)].join('/')
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => parseHash(window.location.hash))
}

export function useSubPath(): string[] {
  // Den Hash-Text abonnieren (stabiler Vergleich), das Array nur bei Änderung neu bilden
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return useMemo(() => parseSubPath(hash), [hash])
}

/** replace: aktuellen Eintrag im Verlauf ersetzen (z. B. nach dem Sichern zurück zur Ansicht) */
export function navigate(to: string, { replace = false } = {}) {
  if (replace) window.location.replace(to)
  else window.location.hash = to
}
