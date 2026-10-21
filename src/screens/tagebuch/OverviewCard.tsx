// Übersichtskarte nach Kern.dc.html: Ring „kcal übrig“ (dynamisches Tagesziel) links, 4 Makro-Balken rechts,
// darunter aufklappbare Zeile „Woche 10.302 / 19.600 kcal“ mit 7 Tagesbalken und gestricheltem Tagesziel.
// Vollständig getrackt: Karte dezent blau getönt, in der Woche ein Punkt unter vollständigen Tagen (Wunsch von Jan).
import { IconChevronDown } from '../../components/icons/icons.tsx'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { ProgressBar } from '../../components/ui/ProgressBar.tsx'
import { Reveal } from '../../components/ui/Reveal.tsx'
import { Ring } from '../../components/ui/Ring.tsx'
import type { LocalDate } from '../../db/types.ts'
import { formatSum, weekBarScale, weekdayShort, type DayOverview } from '../../logic/diary.ts'
import { formatNumber } from '../../logic/format.ts'

const BAR_HEIGHT = 64

const chevronStyle = (open: boolean) => ({
  transform: open ? 'rotate(180deg)' : 'none',
  transition: 'transform var(--kc-motion-chevron-duration) var(--kc-motion-chevron-easing)',
})

type Props = {
  overview: DayOverview
  selected: LocalDate
  weekOpen: boolean
  onToggleWeek: () => void
  /** angezeigter Tag vollständig getrackt */
  complete: boolean
  /** vollständige Tage dieser Woche */
  weekComplete: Set<LocalDate>
}

export function OverviewCard({ overview: o, selected, weekOpen, onToggleWeek, complete, weekComplete }: Props) {
  // Vor dem ersten Profil gibt es kein Ziel: dann zeigt der Ring nur, was gegessen wurde
  const ring =
    o.remaining === null
      ? { value: o.eaten.value ?? 0, label: 'kcal gegessen' }
      : { value: Math.abs(o.remaining), label: o.over ? 'kcal drüber' : 'kcal übrig' }

  return (
    <Card
      summary
      padded={false}
      className={`px-4 pt-4 pb-1 transition-colors duration-300 ${complete ? 'bg-accent-soft!' : ''}`}
    >
      <div className="flex items-center gap-[18px]">
        <Ring progress={o.progress} value={ring.value} label={ring.label} over={o.over} />
        <div className="flex min-w-0 flex-1 flex-col gap-[9px]">
          {o.macros.map((m) => (
            <div key={m.key} className="flex flex-col gap-1">
              <div className="text-secondary flex justify-between gap-1">
                <span className="text-muted truncate">{m.label}</span>
                <span className="font-semibold whitespace-nowrap">
                  {formatSum(m.eaten)}
                  <span className="text-muted font-normal">/{m.goal === null ? '–' : `${formatNumber(m.goal)} g`}</span>
                </span>
              </div>
              <ProgressBar value={m.goal ? (m.eaten.value ?? 0) / m.goal : 0} />
            </div>
          ))}
        </div>
      </div>

      {o.week && (
        <>
          <button
            type="button"
            onClick={onToggleWeek}
            aria-expanded={weekOpen}
            className="border-line text-label mt-3 flex min-h-[46px] w-full items-center justify-between border-t"
          >
            <span className="text-muted">Woche</span>
            <span className="flex items-center gap-1.5">
              <AnimatedNumber value={o.week.consumed} className="font-semibold" />
              <span className="text-muted">/ {formatNumber(o.week.budget)} kcal</span>
              <IconChevronDown className="text-muted" style={chevronStyle(weekOpen)} />
            </span>
          </button>
          {weekOpen && <WeekBars week={o.week} selected={selected} complete={weekComplete} />}
        </>
      )}
    </Card>
  )
}

type WeekProps = { week: NonNullable<DayOverview['week']>; selected: LocalDate; complete: Set<LocalDate> }

function WeekBars({ week, selected, complete }: WeekProps) {
  const scale = weekBarScale(week)
  const px = (kcal: number) => Math.round((Math.min(kcal, scale) / scale) * BAR_HEIGHT)
  return (
    <Reveal className="pt-1 pb-3.5">
      <div className="relative grid h-16 grid-cols-7 items-end gap-2" aria-hidden="true">
        <div
          className="border-muted absolute right-0 left-0 border-t border-dashed opacity-50"
          style={{ bottom: px(week.fixedTarget) }}
        />
        {week.days.map((d) => (
          <div key={d.date} className="flex h-16 items-end">
            <div
              className={`w-full rounded-[6px_6px_3px_3px] ${d.date === selected ? 'bg-accent' : 'bg-neutral-bar'}`}
              style={{
                height: px(d.kcal),
                transition: 'height var(--kc-motion-bars-and-ring-duration) var(--kc-motion-bars-and-ring-easing)',
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-2">
        {week.days.map((d) => (
          <div key={d.date} className="text-tiny flex flex-col items-center gap-px">
            <span className="text-muted">{weekdayShort(d.date)}</span>
            <span>{d.kcal ? formatNumber(d.kcal) : '–'}</span>
            {/* Punkt = vollständig, wie im Monatskalender */}
            <span className={`mt-0.5 size-1 rounded-full ${complete.has(d.date) ? 'bg-accent' : ''}`} />
          </div>
        ))}
      </div>
      <span className="text-tiny text-muted mt-2 block">
        Gestrichelt: festes Tagesziel {formatNumber(week.fixedTarget)} · Punkt = vollständig
      </span>
    </Reveal>
  )
}
