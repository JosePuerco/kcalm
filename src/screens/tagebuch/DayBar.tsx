// Tagesleiste nach Kern.dc.html: Datum „Do 22.10. · Heute“ (Tipp öffnet den Monat), Pfeile, Kalender-Icon.
import type { ReactNode } from 'react'
import { IconArrowLeft, IconArrowRight, IconCalendar, IconChevronDown } from '../../components/icons/icons.tsx'
import { dayLabel } from '../../logic/diary.ts'
import type { LocalDate } from '../../db/types.ts'

type Props = {
  date: LocalDate
  today: LocalDate
  calendarOpen: boolean
  onToggleCalendar: () => void
  onStep: (days: -1 | 1) => void
}

export function DayBar({ date, today, calendarOpen, onToggleCalendar, onStep }: Props) {
  const label = dayLabel(date, today)
  const chevron = {
    transform: calendarOpen ? 'rotate(180deg)' : 'none',
    transition: 'transform var(--kc-motion-chevron-duration) var(--kc-motion-chevron-easing)',
  }
  return (
    <header className="pt-safe-header flex shrink-0 items-center justify-between pr-1.5 pb-1 pl-4">
      <button
        type="button"
        onClick={onToggleCalendar}
        aria-expanded={calendarOpen}
        className="text-body-large min-h-touch-min flex items-center gap-1.5 font-semibold"
      >
        {label.date}
        {label.relative && <span className="text-muted font-normal">· {label.relative}</span>}
        <IconChevronDown className="text-muted" style={chevron} />
      </button>
      <div className="flex">
        <BarButton label="Vorheriger Tag" onClick={() => onStep(-1)}>
          <IconArrowLeft />
        </BarButton>
        <BarButton label={calendarOpen ? 'Kalender schließen' : 'Kalender öffnen'} onClick={onToggleCalendar} active={calendarOpen}>
          <IconCalendar />
        </BarButton>
        <BarButton label="Nächster Tag" onClick={() => onStep(1)}>
          <IconArrowRight />
        </BarButton>
      </div>
    </header>
  )
}

function BarButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`press flex size-11 items-center justify-center ${active ? 'text-accent' : 'text-muted'}`}
    >
      {children}
    </button>
  )
}
