// App-Hülle: füllt den Bildschirm, scrollt selbst nie.
// Gescrollt wird nur im Scrollbereich des jeweiligen Screens.
import { useEffect, type ComponentType } from 'react'
import { OverlayProvider } from '../components/ui/overlay.tsx'
import { Sheet } from '../components/ui/Sheet.tsx'
import { ToastProvider } from '../components/ui/Toast.tsx'
import { Einstellungen } from '../screens/Einstellungen.tsx'
import { Lebensmittel } from '../screens/Lebensmittel.tsx'
import { Statistik } from '../screens/Statistik.tsx'
import { Tagebuch } from '../screens/Tagebuch.tsx'
import { Vorschau } from '../screens/Vorschau.tsx'
import { Setup } from '../screens/setup/Setup.tsx'
import { useLiveQuery } from '../db/live.ts'
import { isSetupDone } from '../db/setup.ts'
import { closeAddSheet, openAddSheet, useAddSheet } from './diaryState.ts'
import { Navigation } from './Navigation.tsx'
import { useRoute, useSubPath, type Route } from './router.ts'
import { initTheme } from './theme.ts'

const screens: Record<Route, ComponentType> = {
  tagebuch: Tagebuch,
  statistik: Statistik,
  lebensmittel: Lebensmittel,
  einstellungen: Einstellungen,
  vorschau: Vorschau,
}

export function App() {
  const route = useRoute()
  // Unterseiten (z. B. Produktdetail) zeigen keine schwebende Navigation (Produkt.dc.html)
  const isSubPage = useSubPath().length > 0
  const addSheet = useAddSheet()

  useEffect(initTheme, [])
  // undefined = lädt noch; live, damit nach Abschluss oder Backup-Import sofort das Tagebuch kommt
  const setupDone = useLiveQuery(isSetupDone, [])

  const CurrentScreen = screens[route]

  return (
    // Referenzbreite 390, fluid bis 430 (DESIGN.md 2)
    <div className="bg-bg text-text relative mx-auto flex h-full w-full max-w-[430px] flex-col overflow-hidden">
      <OverlayProvider>
        <ToastProvider>
          {setupDone === false && <Setup />}
          {setupDone && (
            <>
              <CurrentScreen key={route} />
              {!isSubPage && <Navigation current={route} onAdd={() => openAddSheet()} />}
              {/* Inhalt (Suche, Mengen-Schritt) kommt in Phase 3 */}
              <Sheet open={addSheet.open} onClose={closeAddSheet} title="Hinzufügen" />
            </>
          )}
        </ToastProvider>
      </OverlayProvider>
    </div>
  )
}
