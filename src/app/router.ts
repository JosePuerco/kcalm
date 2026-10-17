// Kleiner Hash-Router: #/statistik statt /statistik, damit GitHub Pages
// beim Neuladen keinen 404 liefert.
import { useSyncExternalStore } from 'react'

export const routes = ['tagebuch', 'statistik', 'lebensmittel', 'einstellungen', 'vorschau'] as const
export type Route = (typeof routes)[number]

export function parseHash(hash: string): Route {
  const name = hash.replace(/^#\/?/, '').split(/[/?]/)[0] ?? ''
  return (routes as readonly string[]).includes(name) ? (name as Route) : 'tagebuch'
}

export function href(route: Route): string {
  return `#/${route}`
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => parseHash(window.location.hash))
}
