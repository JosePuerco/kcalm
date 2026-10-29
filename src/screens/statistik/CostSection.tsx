// Abschnitt „Kosten“ der Statistik (Phase 13, kein Prototyp): Kacheln Ø €/Tag und Summe, € pro Tag als Balken
// (ohne Ziellinie), Preis-Leistung und teuerste Lebensmittel. Nur bei aktiver Kostenauswertung.
// Regeln: PLAN.md 7 „Kosten: Statistik“.
import { AnimatedNumber } from '../../components/ui/AnimatedNumber.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { ProgressBar } from '../../components/ui/ProgressBar.tsx'
import { formatEuro, type CostStats, type CostSum } from '../../logic/cost.ts'
import { formatNumber, UNKNOWN } from '../../logic/format.ts'
import { BarChart } from './BarChart.tsx'
import { Tile } from './StatTiles.tsx'

const RANGE_TEXT: Record<CostStats['range'], string> = {
  week: 'diese Woche',
  month: 'in 4 Wochen',
  quarter: 'in 3 Monaten',
}

export function CostSection({ stats }: { stats: CostStats }) {
  const { tiles, ratios, top, withoutPrice } = stats
  return (
    <section className="flex flex-col gap-3" aria-labelledby="kosten-titel">
      <h2 id="kosten-titel" className="text-small text-muted px-1 pt-2.5 tracking-[0.6px] uppercase">
        Kosten
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <Tile label="Ø pro Tag" sub="vollständige Tage">
          <Euro sum={tiles.avgPerDay} />
        </Tile>
        <Tile label="Summe" sub={RANGE_TEXT[stats.range]}>
          <Euro sum={tiles.total} />
        </Tile>
      </div>

      <BarChart title="€ pro Tag" range={stats.range} bars={stats.bars} scale={stats.scale} goalLine={null} />

      <Card padded={false} className="px-card-padding py-1">
        <h3 className="text-body flex min-h-12 items-center font-semibold">Preis-Leistung</h3>
        <Row label="pro 1.000 kcal" value={formatEuro(ratios.perThousandKcal)} />
        <Row label="pro 100 g Eiweiß" value={formatEuro(ratios.perHundredProtein)} />
        {withoutPrice > 0 && (
          <p className="border-line text-small text-muted border-t py-2.5 leading-[1.45]">
            {withoutPrice === 1 ? '1 Eintrag' : `${formatNumber(withoutPrice)} Einträge`} ohne Preis, nicht mitgerechnet
          </p>
        )}
      </Card>

      <Card padded={false} className="px-card-padding py-1">
        <h3 className="text-body flex min-h-12 items-center font-semibold">Teuerste Lebensmittel</h3>
        {top.length === 0 ? (
          <p className="border-line text-label text-muted flex min-h-touch-min items-center border-t">
            Noch keine Preise in diesem Zeitraum
          </p>
        ) : (
          top.map((f) => (
            <div key={f.key} className="border-line flex flex-col gap-1.5 border-t py-2.5">
              <div className="text-label flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">{f.name}</span>
                <span className="font-semibold whitespace-nowrap">{formatEuro(f.cost)}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="min-w-0 flex-1">
                  <ProgressBar value={f.share} label={`${f.name}: ${formatNumber(f.share * 100)} % der Kosten`} />
                </div>
                {/* Feste Breite, damit alle Anteils-Balken gleich lang sind */}
                <span className="text-small text-muted w-[88px] shrink-0 text-right whitespace-nowrap">
                  {formatNumber(f.share * 100)} % · {f.entries}×
                </span>
              </div>
            </div>
          ))
        )}
      </Card>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-line text-label flex min-h-touch-min items-center justify-between gap-3 border-t">
      <span className="text-muted">{label}</span>
      <span className="font-semibold whitespace-nowrap">{value}</span>
    </div>
  )
}

/** „12,40 €“ mit „mind.“ wie die kcal-Kacheln; unbekannt „–“ */
function Euro({ sum }: { sum: CostSum | null }) {
  if (sum === null || sum.value === null) return <>{UNKNOWN}</>
  return (
    <>
      {sum.atLeast && <span className="text-tiny text-muted font-normal">mind. </span>}
      <AnimatedNumber value={sum.value} decimals={2} />
      <span className="text-secondary text-muted font-normal"> €</span>
    </>
  )
}
