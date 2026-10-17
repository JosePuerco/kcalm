// App-Hülle: füllt den Bildschirm, scrollt selbst nie.
// Gescrollt wird nur im Scrollbereich des jeweiligen Screens.
import { useCallback, useEffect, useState, type ComponentType } from 'react'
import { OverlayProvider } from '../components/ui/overlay.tsx'
import { Sheet } from '../components/ui/Sheet.tsx'
import { ToastProvider } from '../components/ui/Toast.tsx'
import { Einstellungen } from '../screens/Einstellungen.tsx'
import { Lebensmittel } from '../screens/Lebensmittel.tsx'
import { Statistik } from '../screens/Statistik.tsx'
import { Tagebuch } from '../screens/Tagebuch.tsx'
import { Vorschau } from '../screens/Vorschau.tsx'
import { Navigation } from './Navigation.tsx'
import { useRoute, type Route } from './router.ts'
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
  const [addOpen, setAddOpen] = useState(false)
  const closeAdd = useCallback(() => setAddOpen(false), [])

  useEffect(initTheme, [])

  const CurrentScreen = screens[route]

  return (
    // Referenzbreite 390, fluid bis 430 (DESIGN.md 2)
    <div className="bg-bg text-text relative mx-auto flex h-full w-full max-w-[430px] flex-col overflow-hidden">
      <OverlayProvider>
        <ToastProvider>
          <CurrentScreen key={route} />
          <Navigation current={route} onAdd={() => setAddOpen(true)} />
          {/* Inhalt (Suche, Mengen-Schritt) kommt in Phase 3 */}
          <Sheet open={addOpen} onClose={closeAdd} title="Hinzufügen" />
        </ToastProvider>
      </OverlayProvider>
    </div>
  )
}
