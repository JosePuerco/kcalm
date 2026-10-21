import type { ReactNode } from 'react'
import { href, useSubPath } from '../app/router.ts'
import { IconChevronRight } from '../components/icons/icons.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Screen } from '../components/ui/Screen.tsx'
import { useLiveQuery } from '../db/live.ts'
import { getSlots } from '../db/slots.ts'
import { formatNumber } from '../logic/format.ts'
import { BackupCard } from './BackupCard.tsx'
import { SlotsScreen } from './einstellungen/SlotsScreen.tsx'

// Einstellungen und Unterseiten über den Hash-Pfad
//  #/einstellungen          Übersicht
//  #/einstellungen/slots    Mahlzeiten-Slots
export function Einstellungen() {
  const [view] = useSubPath()
  if (view === 'slots') return <SlotsScreen />
  return <Overview />
}

// Gruppen nach Einstellungen.dc.html. Profile, Funktionen, Darstellung und Über folgen später.
function Overview() {
  const slots = useLiveQuery(getSlots, [])
  const slotsMeta = slots
    ? `${formatNumber(slots.length)}${slots.some((s) => s.timeFrom) ? ' · mit Uhrzeiten' : ''}`
    : ''

  return (
    <Screen title="Einstellungen">
      <Group title="Ziele">
        <Card padded={false}>
          <LinkRow to={href('einstellungen', 'slots')} label="Mahlzeiten-Slots" meta={slotsMeta} />
        </Card>
      </Group>
      <Group title="Daten">
        <BackupCard />
      </Group>
      {/* Bis Phase 11: Zugang zur Bausteine-Vorschau (in der PWA gibt es keine Adresszeile) */}
      <Card padded={false}>
        <LinkRow to={href('vorschau')} label="Bausteine (Vorschau)" />
      </Card>
    </Screen>
  )
}

function LinkRow({ to, label, meta, border }: { to: string; label: string; meta?: string; border?: boolean }) {
  return (
    <a
      href={to}
      className={`text-text flex min-h-[52px] items-center gap-2.5 pr-3 pl-4 ${border ? 'border-line border-t' : ''}`}
    >
      <span className="text-body flex-1">{label}</span>
      {meta && <span className="text-label text-muted">{meta}</span>}
      <IconChevronRight className="text-chevron-muted" />
    </a>
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
