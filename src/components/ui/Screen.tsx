// Gerüst für jeden Screen: fester Kopf + genau ein Scrollbereich (DESIGN.md 2).
// Kinder des Scrollbereichs schrumpfen nicht (Utility scroll-area).
import type { ReactNode } from 'react'

type Props = {
  title: string
  /** Knopf rechts im Kopf, z. B. „Neu“ */
  action?: ReactNode
  /** Feste Elemente zwischen Kopf und Scrollbereich (Suche, Reiter) */
  toolbar?: ReactNode
  children?: ReactNode
}

export function Screen({ title, action, toolbar, children }: Props) {
  return (
    <>
      <header
        className={`pt-safe-header flex shrink-0 items-center justify-between pl-5 ${action ? 'pr-2 pb-1.5' : 'pr-5 pb-2'}`}
      >
        <h1 className="text-title">{title}</h1>
        {action}
      </header>
      {toolbar}
      <main className="scroll-area px-screen-x pb-scroll-bottom-padding gap-card-gap flex flex-col">{children}</main>
    </>
  )
}
