// Verbrauchsschätzung nach Schaetzung.dc.html: Ergebnis (Zahl ± Spanne, Leiste mit Budget-Strich, Vergleich
// zum Budget, Grundlagen) oder „Sammelt Daten“ (Raster), darunter Gewicht: einfügen, manuell, Anleitung.
// Ohne die Demo-Umschaltung des Prototyps; der Zustand ergibt sich aus den Daten.
import { useState } from 'react'
import { useToday } from '../../app/diaryState.ts'
import { href } from '../../app/router.ts'
import { IconBack } from '../../components/icons/icons.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { loadEstimate, type EstimateData } from '../../db/estimate.ts'
import { useLiveQuery } from '../../db/live.ts'
import { importWeights } from '../../db/weights.ts'
import type { EstimateCollecting, EstimateReady } from '../../logic/estimate.ts'
import {
  budgetView,
  collectingView,
  importMessage,
  lastWeightText,
  resultView,
  type CollectCell,
} from '../../logic/estimateView.ts'
import { formatNumber } from '../../logic/format.ts'
import { GuideSheet } from './schaetzung/GuideSheet.tsx'
import { ManualWeightSheet } from './schaetzung/ManualWeightSheet.tsx'
import { PasteSheet } from './schaetzung/PasteSheet.tsx'

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
  const toast = useToast()
  const [sheet, setSheetState] = useState<null | 'paste' | 'manual' | 'guide'>(null)
  // Neuer key je Öffnen: Sheets starten ohne alte Eingaben
  const [sheetKey, setSheetKey] = useState(0)
  const setSheet = (next: typeof sheet) => {
    if (next) setSheetKey((k) => k + 1)
    setSheetState(next)
  }
  const [pasteError, setPasteError] = useState<string | null>(null)
  const e = data.estimate

  const paste = async () => {
    let text: string
    try {
      text = await navigator.clipboard.readText()
    } catch {
      // Lesen verweigert oder nicht möglich: Text selbst einfügen lassen
      setPasteError(null)
      setSheet('paste')
      return
    }
    const result = await importWeights(text)
    if (result.ok) {
      toast(importMessage(result))
    } else {
      setPasteError(result.error)
      setSheet('paste')
    }
  }

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
          <span className="text-muted">Letztes Gewicht</span>
          <span className="font-semibold">{lastWeightText(data.weights.at(-1), today)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void paste()}
            className="press rounded-field bg-accent text-on-accent text-label min-h-12 text-center font-semibold"
          >
            Gewichte einfügen
          </button>
          <button
            type="button"
            onClick={() => setSheet('manual')}
            className="press rounded-field bg-bg text-label min-h-12 text-center font-semibold"
          >
            Manuell eintragen
          </button>
        </div>
        <p className="text-small text-muted leading-[1.45]">
          Erst den Kurzbefehl „Kcalm Gewichte“ ausführen, dann hier einfügen.{' '}
          <button type="button" onClick={() => setSheet('guide')} className="text-accent-text font-medium">
            Kurzbefehl einrichten
          </button>
        </p>
      </Card>

      <PasteSheet
        key={`p${sheetKey}`}
        open={sheet === 'paste'}
        initialError={pasteError}
        onClose={() => setSheet(null)}
        onImported={(message) => {
          setSheet(null)
          toast(message)
        }}
      />
      <ManualWeightSheet key={`m${sheetKey}`} open={sheet === 'manual'} onClose={() => setSheet(null)} weights={data.weights} today={today} />
      <GuideSheet open={sheet === 'guide'} onClose={() => setSheet(null)} />
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
