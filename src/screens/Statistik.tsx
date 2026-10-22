// Statistik (Statistik.dc.html): Zeitraum, Kacheln, kcal pro Tag, Makros.
// Gewicht folgt in Phase 9 mit der Verbrauchsschätzung.
import { useState } from 'react'
import { Screen } from '../components/ui/Screen.tsx'
import { Segmented } from '../components/ui/Segmented.tsx'
import { useToday } from '../app/diaryState.ts'
import { useLiveQuery } from '../db/live.ts'
import { loadStats } from '../db/stats.ts'
import type { StatsRange } from '../logic/stats.ts'
import { KcalChart } from './statistik/KcalChart.tsx'
import { MacroCard } from './statistik/MacroCard.tsx'
import { StatTiles } from './statistik/StatTiles.tsx'

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
          <KcalChart stats={stats} />
          <MacroCard macros={stats.macros} />
        </>
      )}
    </Screen>
  )
}
