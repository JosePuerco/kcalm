// Datenbankabfrage, die sich bei Änderungen selbst aktualisiert (Dexie liveQuery).
// Eigener kleiner Hook statt der Zusatzbibliothek dexie-react-hooks.
import { liveQuery } from 'dexie'
import { useEffect, useState, type DependencyList } from 'react'

/** undefined = lädt noch */
export function useLiveQuery<T>(query: () => Promise<T>, deps: DependencyList): T | undefined {
  const [value, setValue] = useState<T>()
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: setValue,
      error: (error: unknown) => console.error('Datenbankabfrage fehlgeschlagen', error),
    })
    return () => subscription.unsubscribe()
    // Die Abfrage hängt nur von deps ab (wie bei useMemo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return value
}
