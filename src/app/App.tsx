// App-Hülle: füllt den Bildschirm, scrollt selbst nie.
// Gescrollt wird nur im Scrollbereich des jeweiligen Screens.
import { Suspense, lazy, useEffect, type ComponentType } from 'react'
import { OverlayProvider } from '../components/ui/overlay.tsx'
import { ToastProvider } from '../components/ui/Toast.tsx'
import { Einstellungen } from '../screens/Einstellungen.tsx'
import { Lebensmittel } from '../screens/Lebensmittel.tsx'
import { Statistik } from '../screens/Statistik.tsx'
import { Tagebuch } from '../screens/Tagebuch.tsx'
import { Setup } from '../screens/setup/Setup.tsx'
import { AddSheet } from '../screens/add/AddSheet.tsx'
import { useLiveQuery } from '../db/live.ts'
import { isSetupDone } from '../db/setup.ts'
import { openAddSheet } from './diaryState.ts'
import { usePendingSyncTriggers } from './pendingSync.ts'
import { Navigation } from './Navigation.tsx'
import { useRoute, useSubPath, type Route } from './router.ts'
import { initTheme } from './theme.ts'

// Bausteine-Vorschau nur im Entwicklungsmodus: Im Build ist DEV false, der Import fällt weg
// und #/vorschau zeigt das Tagebuch.
const Vorschau = import.meta.env.DEV ? lazy(() => import('../screens/Vorschau.tsx').then((m) => ({ default: m.Vorschau }))) : null

const screens: Record<Route, ComponentType | null> = {
  tagebuch: Tagebuch,
  statistik: Statistik,
  lebensmittel: Lebensmittel,
  einstellungen: Einstellungen,
  vorschau: Vorschau,
}

/** Gemerkte Scans im Hintergrund nachladen (erst nach der Ersteinrichtung) */
function PendingSync() {
  usePendingSyncTriggers()
  return null
}

export function App() {
  const route = useRoute()
  // Unterseiten (z. B. Produktdetail) zeigen keine schwebende Navigation (Produkt.dc.html)
  const isSubPage = useSubPath().length > 0

  useEffect(initTheme, [])
  // undefined = lädt noch; live, damit nach Abschluss oder Backup-Import sofort das Tagebuch kommt
  const setupDone = useLiveQuery(isSetupDone, [])

  const CurrentScreen = screens[route] ?? Tagebuch

  return (
    // Referenzbreite 390, fluid bis 430 (DESIGN.md 2)
    <div className="bg-bg text-text relative mx-auto flex h-full w-full max-w-[430px] flex-col overflow-hidden">
      <OverlayProvider>
        <ToastProvider>
          {setupDone === false && <Setup />}
          {setupDone && (
            <>
              <Suspense fallback={null}>
                <CurrentScreen key={route} />
              </Suspense>
              {!isSubPage && <Navigation current={route} onAdd={() => openAddSheet()} />}
              <AddSheet />
              <PendingSync />
            </>
          )}
        </ToastProvider>
      </OverlayProvider>
    </div>
  )
}
