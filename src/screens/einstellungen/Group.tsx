// Gruppe in den Einstellungen nach Einstellungen.dc.html: Überschrift in Großbuchstaben, darunter Karten.
import type { ReactNode } from 'react'

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-small text-muted px-1 pt-2.5 tracking-[0.6px] uppercase">{title}</h2>
      {children}
    </section>
  )
}
