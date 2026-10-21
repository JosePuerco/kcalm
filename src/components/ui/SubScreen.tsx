// Gerüst für Unterseiten (Produktdetail, Formular) nach Produkt.dc.html:
// Zurück-Pfeil oben links, Titel im Scrollbereich, keine schwebende Navigation.
import type { ReactNode } from 'react'
import { IconBack } from '../icons/icons.tsx'

type Props = {
  /** Ziel des Zurück-Pfeils (Hash-Link) oder Funktion, z. B. im Formular über dem Scanner */
  back: string | (() => void)
  /** Knopf rechts im Kopf */
  action?: ReactNode
  children?: ReactNode
}

export function SubScreen({ back, action, children }: Props) {
  return (
    <>
      <header className="pt-safe-header flex shrink-0 items-center justify-between pr-2 pl-1">
        {typeof back === 'string' ? (
          <a href={back} aria-label="Zurück" className="press text-text flex size-11 items-center justify-center">
            <IconBack />
          </a>
        ) : (
          <button type="button" onClick={back} aria-label="Zurück" className="press text-text flex size-11 items-center justify-center">
            <IconBack />
          </button>
        )}
        {action}
      </header>
      {/* Ohne Navigation reichen 24 px unten (Prototyp) plus Safe Area */}
      <main className="scroll-area px-screen-x gap-card-gap flex flex-col pb-[calc(24px+env(safe-area-inset-bottom))]">
        {children}
      </main>
    </>
  )
}

/** Titelblock oben im Scrollbereich: Name, Meta-Zeile, Badges */
export function SubScreenTitle({ title, meta, children }: { title: string; meta?: string; children?: ReactNode }) {
  return (
    <div className="px-1 pb-1">
      <h1 className="text-title break-words">{title}</h1>
      {meta && <span className="text-secondary text-muted mt-1 block">{meta}</span>}
      {children && <div className="mt-2.5 flex flex-wrap gap-1.5">{children}</div>}
    </div>
  )
}

/** Badge wie im Prototyp (Quelle, Prüfstatus) */
export function Badge({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'accent' }) {
  return (
    <span
      className={`text-small rounded-small-button inline-flex items-center gap-1 px-2.5 py-[5px] ${
        tone === 'accent' ? 'bg-accent-soft text-accent-text font-medium' : 'bg-card text-muted'
      }`}
    >
      {children}
    </span>
  )
}
