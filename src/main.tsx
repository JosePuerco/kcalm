import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { App } from './app/App.tsx'
import { installKeyboardGuard } from './app/keyboardGuard.ts'

// iOS ignoriert user-scalable=no teilweise: Pinch-Zoom zusätzlich abfangen
document.addEventListener('gesturestart', (e) => e.preventDefault())

// iOS: Seite nach dem Schließen der Tastatur wieder an den Anfang (sonst bleibt sie verschoben)
installKeyboardGuard()

// Browser bitten, die Daten bei Speichermangel nicht zu löschen (iOS fragt dabei nicht nach)
void navigator.storage
  ?.persisted?.()
  .then((persisted) => persisted || navigator.storage.persist())
  .catch((error: unknown) => console.warn('Dauerhafter Speicher nicht verfügbar', error))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
