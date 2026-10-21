import type { ReactNode } from 'react'
import { href } from '../app/router.ts'
import { IconChevronRight } from '../components/icons/icons.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Screen } from '../components/ui/Screen.tsx'
import { BackupCard } from './BackupCard.tsx'

// Gruppen nach Einstellungen.dc.html. Ziele, Funktionen, Darstellung und Über kommen in späteren Phasen.
export function Einstellungen() {
  return (
    <Screen title="Einstellungen">
      <Group title="Daten">
        <BackupCard />
      </Group>
      {/* Bis Phase 11: Zugang zur Bausteine-Vorschau (in der PWA gibt es keine Adresszeile) */}
      <Card padded={false}>
        <a href={href('vorschau')} className="text-text flex min-h-[52px] items-center gap-2.5 pr-3 pl-4">
          <span className="text-body flex-1">Bausteine (Vorschau)</span>
          <IconChevronRight className="text-chevron-muted" />
        </a>
      </Card>
    </Screen>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-small text-muted px-1 pt-2.5 tracking-[0.6px] uppercase">{title}</h2>
      {children}
    </section>
  )
}
