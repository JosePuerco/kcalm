// App-Hülle: füllt den Bildschirm, scrollt selbst nie.
// Gescrollt wird nur im Scrollbereich des jeweiligen Screens.
import { useEffect, useState, type ComponentType } from 'react'
import { Einstellungen } from '../screens/Einstellungen.tsx'
import { Lebensmittel } from '../screens/Lebensmittel.tsx'
import { Statistik } from '../screens/Statistik.tsx'
import { Tagebuch } from '../screens/Tagebuch.tsx'
import { Navigation } from './Navigation.tsx'
import { useRoute, type Route } from './router.ts'
import { initTheme } from './theme.ts'

const screens: Record<Route, ComponentType> = {
  tagebuch: Tagebuch,
  statistik: Statistik,
  lebensmittel: Lebensmittel,
  einstellungen: Einstellungen,
  vorschau: Tagebuch,
}

export function App() {
  const route = useRoute()
  const [, setAddOpen] = useState(false)

  useEffect(initTheme, [])

  const CurrentScreen = screens[route]

  return (
    // Referenzbreite 390, fluid bis 430 (DESIGN.md 2)
    <div className="bg-bg text-text relative mx-auto flex h-full w-full max-w-[430px] flex-col overflow-hidden">
      <CurrentScreen key={route} />
      <Navigation current={route} onAdd={() => setAddOpen(true)} />
    </div>
  )
}
