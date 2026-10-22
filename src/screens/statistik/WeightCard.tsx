// Gewicht (Statistik.dc.html): Messpunkte grau, Trendlinie blau, Linien oben/Mitte/unten mit kg-Werten.
// Oben rechts der Link zur Verbrauchsschätzung. Nur bei aktiver Schätzung sichtbar.
import { href } from '../../app/router.ts'
import { Card } from '../../components/ui/Card.tsx'
import { formatNumber } from '../../logic/format.ts'
import type { WeightChart } from '../../logic/weightChart.ts'

// Zeichenfläche wie im Prototyp: 326 × 120, Linien bei 20 / 60 / 100
const W = 326
const H = 120
const TOP = 20
const BOTTOM = 100

type Props = {
  chart: WeightChart | null
  /** „Verbrauch 2.585 ± 150 kcal“ bzw. „Sammelt Daten“ */
  estimateText: string
}

export function WeightCard({ chart, estimateText }: Props) {
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-body font-semibold">Gewicht</h2>
        <a
          href={href('einstellungen', 'schaetzung')}
          className="text-secondary text-accent-text min-h-touch-min -my-2.5 flex items-center"
        >
          {estimateText}
        </a>
      </div>
      {chart ? <Chart chart={chart} /> : <p className="text-label text-muted mt-2">Keine Wiegungen in diesem Zeitraum</p>}
    </Card>
  )
}

function Chart({ chart }: { chart: WeightChart }) {
  const x = (v: number) => (v * W).toFixed(1)
  const y = (kg: number) => (TOP + ((chart.max - kg) / (chart.max - chart.min)) * (BOTTOM - TOP)).toFixed(1)
  // Punkte als Linien der Länge 0 mit runden Enden (wie im Prototyp)
  const dots = chart.measured.map((p) => `M${x(p.x)} ${y(p.kg)}h0`).join('')
  const trend = chart.trend.map((p, i) => `${i ? 'L' : 'M'}${x(p.x)} ${y(p.kg)}`).join('')
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={chart.label} className="mt-2 block">
        {[TOP, (TOP + BOTTOM) / 2, BOTTOM].map((ly) => (
          <line key={ly} x1="0" y1={ly} x2={W} y2={ly} className="stroke-line" strokeWidth="1" />
        ))}
        <path d={dots} fill="none" className="stroke-neutral-bar" strokeWidth="5" strokeLinecap="round" />
        {chart.trend.length > 1 && (
          <path d={trend} fill="none" className="stroke-accent" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
        <text x="0" y={TOP - 4} className="text-tiny fill-muted">
          {formatNumber(chart.max, 1)}
        </text>
        <text x="0" y={BOTTOM - 4} className="text-tiny fill-muted">
          {formatNumber(chart.min, 1)}
        </text>
      </svg>
      <div className="text-small text-muted mt-1.5 flex items-center gap-3.5">
        <span className="flex items-center gap-1.5">
          <span className="bg-neutral-bar size-2 rounded-full" />
          Messung
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-accent h-0.5 w-3.5" />
          Trend
        </span>
        {chart.changeText && <span className="ml-auto">{chart.changeText}</span>}
      </div>
    </>
  )
}
