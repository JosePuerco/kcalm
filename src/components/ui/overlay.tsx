// Overlay-Ebene über dem Screen (für Sheet und Toast).
// Sheets und Toast werden per Portal hierher gezeichnet, damit kein Scrollbereich sie abschneidet.
import { createContext, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const OverlayContext = createContext<HTMLElement | null>(null)

/** Stellt die Overlay-Ebene bereit; muss innerhalb der App-Hülle (position: relative) liegen */
export function OverlayProvider({ children }: { children: ReactNode }) {
  const [root, setRoot] = useState<HTMLElement | null>(null)
  return (
    <OverlayContext.Provider value={root}>
      {children}
      <div ref={setRoot} className="pointer-events-none absolute inset-0 z-20 *:pointer-events-auto" />
    </OverlayContext.Provider>
  )
}

/** Zeichnet die Kinder in die Overlay-Ebene */
export function Overlay({ children }: { children: ReactNode }) {
  const root = useContext(OverlayContext)
  return root ? createPortal(children, root) : null
}
