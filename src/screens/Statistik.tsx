// Statistik (Statistik.dc.html): Zeitraum, Kacheln, kcal pro Tag, Makros,
// Gewicht (nur bei aktiver Verbrauchsschätzung), Kosten (nur bei aktiver Kostenauswertung).
import { useState } from 'react'
import { Screen } from '../components/ui/Screen.tsx'
import { Segmented } from '../components/ui/Segmented.tsx'
import { useToday } from '../app/diaryState.ts'
import { getCostsEnabled, loadCostStats } from '../db/costs.ts'
import { useLiveQuery } from '../db/live.ts'
import { loadEstimate } from '../db/estimate.ts'
import { loadStats } from '../db/stats.ts'
import { getEstimateEnabled } from '../db/weights.ts'
import { estimateLinkText } from '../logic/estimateView.ts'
import { statsDates, type StatsRange } from '../logic/stats.ts'
import { weightChart } from '../logic/weightChart.ts'
import { BarChart } from './statistik/BarChart.tsx'
import { CostSection } from './statistik/CostSection.tsx'
import { MacroCard } from './statistik/MacroCard.tsx'
import { StatTiles } from './statistik/StatTiles.tsx'
import { WeightCard } from './statistik/WeightCard.tsx'

const RANGES = [
  { value: 'week', label: 'Woche' },
  { value: 'month', label: '4 Wochen' },
  { value: 'quarter', label: '3 Monate' },
] as const satisfies readonly { value: StatsRange; label: string }[]

// Überlebt den Screen-Wechsel, nicht den Neustart der App
let lastRange: StatsRange = 'week'

export function Statistik() {
  const today = useToday()
  const [range, setRange] = useState<StatsRange>(lastRange)
  const stats = useLiveQuery(() => loadStats(today, range), [today, range])
  const estimateOn = useLiveQuery(getEstimateEnabled, [])
  const estimate = useLiveQuery(() => loadEstimate(today), [today])
  const costsOn = useLiveQuery(getCostsEnabled, [])
  const costs = useLiveQuery(() => (costsOn ? loadCostStats(today, range) : Promise.resolve(null)), [today, range, costsOn])

  const pick = (next: StatsRange) => {
    lastRange = next
    setRange(next)
  }

  return (
    <Screen
      title="Statistik"
      toolbar={
        <div className="px-screen-x shrink-0 pb-2.5">
          <Segmented options={RANGES} value={range} onChange={pick} label="Zeitraum" />
        </div>
      }
    >
      {stats && (
        <>
          <StatTiles tiles={stats.tiles} goal={stats.goalLine} />
          <BarChart title="kcal pro Tag" range={stats.range} bars={stats.bars} scale={stats.scale} goalLine={stats.goalLine} />
          <MacroCard macros={stats.macros} />
          {estimateOn && estimate && (
            <WeightCard
              chart={weightChart(statsDates(today, range), today, estimate.weights, range)}
              estimateText={estimateLinkText(estimate.estimate)}
            />
          )}
          {costs && <CostSection stats={costs} />}
        </>
      )}
    </Screen>
  )
}
