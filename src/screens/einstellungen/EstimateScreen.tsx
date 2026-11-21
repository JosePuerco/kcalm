// Verbrauchsschätzung nach Schaetzung.dc.html: Ergebnis (Zahl ± Spanne, Leiste mit Budget-Strich, Vergleich
// zum Budget, Grundlagen) oder „Sammelt Daten“ (Raster), darunter die letzte Wiegung aus Garmin (Phase 16.2:
// Gewichte kommen nur noch über Fitboard, kein Einfügen und kein manuelles Eintragen mehr).
// Ohne die Demo-Umschaltung des Prototyps; der Zustand ergibt sich aus den Daten.
import { useToday } from '../../app/diaryState.ts'
import { usePushView } from '../../app/pushSync.ts'
import { href } from '../../app/router.ts'
import { IconBack } from '../../components/icons/icons.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { loadEstimate, type EstimateData } from '../../db/estimate.ts'
import { useLiveQuery } from '../../db/live.ts'
import type { EstimateCollecting, EstimateReady } from '../../logic/estimate.ts'
import {
  budgetView,
  collectingView,
  lastWeightText,
  resultView,
  type CollectCell,
} from '../../logic/estimateView.ts'
import { formatNumber } from '../../logic/format.ts'

const back = href('einstellungen')

export function EstimateScreen() {
  const today = useToday()
  const data = useLiveQuery(() => loadEstimate(today), [today])
  return (
    <>
      <header className="pt-safe-header flex shrink-0 items-center justify-between pr-2 pl-1">
        <a href={back} aria-label="Zurück" className="press text-text flex size-11 items-center justify-center">
          <IconBack />
        </a>
        <h1 className="text-sheet-title">Verbrauchsschätzung</h1>
        <span className="w-11" />
      </header>
      <main className="scroll-area px-screen-x gap-card-gap flex flex-col pt-2 pb-[calc(24px+env(safe-area-inset-bottom))]">
        {data && <EstimateBody data={data} today={today} />}
      </main>
    </>
  )
}

function EstimateBody({ data, today }: { data: EstimateData; today: string }) {
  const push = usePushView()
  const on = push.config.enabled && push.config.suggestions
  const e = data.estimate

  return (
    <>
      {e.status === 'ready' ? (
        <Result estimate={e} budget={data.budget} />
      ) : (
        <Collecting estimate={e} data={data} today={today} />
      )}

      <h2 className="text-small text-muted px-1 pt-2 tracking-[0.6px] uppercase">Gewicht</h2>
      <Card className="flex flex-col gap-2.5 py-3.5">
        <div className="text-label flex items-center justify-between gap-3">
          <span className="text-muted shrink-0">Gewicht aus Garmin</span>
          <span className="text-right font-semibold">{lastWeightText(data.weights.at(-1), today)}</span>
        </div>
        {!on && (
          <p className="text-small text-muted leading-[1.45]">
            Gewichte kommen aus Garmin. Einschalten unter Einstellungen › Daten › Server-Push › Daten aus Fitboard.
          </p>
        )}
        {on && push.inbox.lastError && <p className="text-small text-warn-text leading-[1.45]">{push.inbox.lastError}</p>}
      </Card>
    </>
  )
}

function Result({ estimate, budget }: { estimate: EstimateReady; budget: number | null }) {
  const v = resultView(estimate, budget)
  const b = budget === null ? null : budgetView(estimate, budget)
  return (
    <>
      <div className="bg-card rounded-calendar px-4 py-[18px]">
        <span className="text-secondary text-muted">Dein geschätzter Verbrauch</span>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-hero">{v.kcal}</span>
          <span className="text-body-large text-muted">{v.spread}</span>
        </div>
        <div aria-hidden="true" className="relative mt-3.5 h-[26px]">
          <div className="bg-track absolute inset-x-0 top-[11px] h-1 rounded-full" />
          <div
            className="bg-accent-soft-border absolute top-[9px] h-2 rounded-full"
            style={{ left: `${v.bar.rangeLeft}%`, width: `${v.bar.rangeWidth}%` }}
          />
          <div
            className="bg-accent absolute top-[5px] h-4 w-1 -translate-x-1/2 rounded-full"
            style={{ left: `${v.bar.marker}%` }}
          />
          {v.bar.budget !== null && (
            <div
              className="border-muted absolute top-[3px] h-5 border-l-[1.5px] border-dashed"
              style={{ left: `${v.bar.budget}%` }}
            />
          )}
        </div>
        <div className="text-tiny text-muted flex justify-between gap-2">
          <span>{formatNumber(v.bar.min)}</span>
          <span className="text-center">{v.caption}</span>
          <span>{formatNumber(v.bar.max)}</span>
        </div>
      </div>

      {b && (
        <Card className="flex flex-col gap-1.5 py-3.5">
          <span className="text-body font-semibold">Im Vergleich zu deinem Budget</span>
          <p className="text-label leading-normal">
            {b.direction === 'equal' ? (
              <>Dein Budget entspricht dem geschätzten Verbrauch. Dein Gewicht bleibt rechnerisch gleich.</>
            ) : (
              <>
                Dein Budget liegt <span className="font-semibold">{b.diff}</span>{' '}
                {b.direction === 'over' ? 'über' : 'unter'} dem Verbrauch. Das entspricht rechnerisch etwa{' '}
                <span className="font-semibold">{b.kgPerWeek}</span>.
              </>
            )}
          </p>
          <span className="text-small text-muted leading-[1.45]">
            Die Schätzung ändert dein Ziel nicht. Ob du anpasst, entscheidest du im Profil.
          </span>
        </Card>
      )}

      <Card padded={false} className="px-4 py-1">
        {v.basis.map((row, i) => (
          <div
            key={row.label}
            className={`text-label flex min-h-[46px] items-center justify-between ${i ? 'border-line border-t' : ''}`}
          >
            <span className="text-muted">{row.label}</span>
            <span className="font-semibold">{row.value}</span>
          </div>
        ))}
      </Card>
    </>
  )
}

const cellColor: Record<CollectCell, string> = {
  counted: 'bg-accent',
  skipped: 'bg-neutral-bar',
  open: 'bg-track',
}

function Collecting({ estimate, data, today }: { estimate: EstimateCollecting; data: EstimateData; today: string }) {
  const v = collectingView(estimate, data.days, today)
  return (
    <>
      <div className="bg-card rounded-calendar px-4 py-[18px]">
        <span className="text-secondary text-muted">{v.label}</span>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-hero">{formatNumber(v.value)}</span>
          <span className="text-body-large text-muted">{v.unit}</span>
        </div>
        {v.cells.length > 0 && (
          <div aria-hidden="true" className="mt-3.5 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1">
            {v.cells.map((c, i) => (
              <span key={i} className={`rounded-bar-top h-[22px] ${cellColor[c]}`} />
            ))}
          </div>
        )}
        <div className="text-small text-muted mt-2.5 flex gap-3.5">
          <span className="flex items-center gap-1.5">
            <span className="bg-accent rounded-bar-top size-2.5" />
            vollständig
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-neutral-bar rounded-bar-top size-2.5" />
            zählt nicht
          </span>
        </div>
        {v.weightHint && <p className="text-small text-muted mt-2.5 leading-[1.45]">{v.weightHint}</p>}
      </div>
      <Card className="text-label leading-normal">
        Gezählt werden nur Tage, die du als vollständig markiert hast. Fehlende Wiegetage sind kein Problem, das
        Gewicht läuft über einen geglätteten Trend.
      </Card>
    </>
  )
}
