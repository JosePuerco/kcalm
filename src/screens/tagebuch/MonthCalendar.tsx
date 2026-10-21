// Monatskalender nach Kern.dc.html: klappt als Karte oben im Inhalt auf; angezeigter Tag blau gefüllt,
// Punkt unter vollständigen Tagen, Zukunft muted. Monatspfeile sind eine Ergänzung zum Prototyp,
// damit frühere Monate ohne Tag-für-Tag-Klicken erreichbar sind.
import { IconArrowLeft, IconArrowRight } from '../../components/icons/icons.tsx'
import { Reveal } from '../../components/ui/Reveal.tsx'
import type { LocalDate } from '../../db/types.ts'
import { addMonths, monthGrid, monthLabel } from '../../logic/diary.ts'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

type Props = {
  month: string
  selected: LocalDate
  today: LocalDate
  completeDates: Set<LocalDate>
  onMonth: (month: string) => void
  onPick: (date: LocalDate) => void
}

export function MonthCalendar({ month, selected, today, completeDates, onMonth, onPick }: Props) {
  return (
    <Reveal className="bg-card rounded-calendar px-3 pt-3.5 pb-2.5">
      <div className="flex items-center justify-between pb-1 pl-1">
        <div className="flex items-center">
          <span className="text-body w-[8.5rem] font-semibold">{monthLabel(month)}</span>
          <button
            type="button"
            aria-label="Vorheriger Monat"
            onClick={() => onMonth(addMonths(month, -1))}
            className="press text-muted flex size-11 items-center justify-center"
          >
            <IconArrowLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Nächster Monat"
            onClick={() => onMonth(addMonths(month, 1))}
            className="press text-muted flex size-11 items-center justify-center"
          >
            <IconArrowRight size={16} />
          </button>
        </div>
        <span className="text-small text-muted pr-1">Punkt = vollständig</span>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-tiny text-muted pb-1 text-center">
            {w}
          </span>
        ))}
        {monthGrid(month).map((date, i) => {
          if (!date) return <span key={`leer-${i}`} />
          const isSelected = date === selected
          const color = isSelected ? 'bg-accent text-on-accent' : date === today ? 'text-accent-text font-semibold' : date > today ? 'text-muted' : 'text-text'
          return (
            <button
              key={date}
              type="button"
              onClick={() => onPick(date)}
              aria-label={`${Number(date.slice(8))}. ${monthLabel(month)}${completeDates.has(date) ? ', vollständig' : ''}`}
              aria-current={isSelected ? 'date' : undefined}
              className="flex h-11 flex-col items-center justify-center gap-0.5"
            >
              <span className={`text-label flex size-[30px] items-center justify-center rounded-full ${color}`}>
                {Number(date.slice(8))}
              </span>
              <span className={`size-1 rounded-full ${completeDates.has(date) ? 'bg-accent' : ''}`} />
            </button>
          )
        })}
      </div>
    </Reveal>
  )
}
