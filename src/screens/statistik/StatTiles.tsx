// Drei Kacheln: Ø kcal/Tag, Vollständig, Bilanz. Ohne vollständige Tage „–“ statt 0.
import type { ReactNode } from 'react'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber.tsx'
import { formatNumber, UNKNOWN } from '../../logic/format.ts'
import type { NutrientSum } from '../../logic/nutrients.ts'
import type { StatsTiles } from '../../logic/stats.ts'

type Props = { tiles: StatsTiles; goal: number | null }

export function StatTiles({ tiles, goal }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Tile label="Ø kcal/Tag" sub={goal === null ? 'ohne Ziel' : `Ziel ${formatNumber(goal)}`}>
        <Value sum={tiles.avgKcal} />
      </Tile>
      <Tile label="Vollständig" sub="Tage">
        {tiles.completeDays}/{tiles.trackedDays}
      </Tile>
      <Tile label="Bilanz" sub="kcal/Tag zum Ziel">
        <Value sum={tiles.balance} signed />
      </Tile>
    </div>
  )
}

function Tile({ label, sub, children }: { label: string; sub: string; children: ReactNode }) {
  return (
    <div className="bg-card rounded-card flex min-w-0 flex-col gap-1 p-3">
      <span className="text-small text-muted">{label}</span>
      <span className="text-unit truncate font-semibold">{children}</span>
      <span className="text-tiny text-muted">{sub}</span>
    </div>
  )
}

function Value({ sum, signed = false }: { sum: NutrientSum | null; signed?: boolean }) {
  if (sum === null || sum.value === null) return <>{UNKNOWN}</>
  // Vorzeichen nach der Rundung, damit −0,4 nicht als „−0“ erscheint
  const rounded = Math.round(sum.value)
  const sign = signed ? (rounded > 0 ? '+' : rounded < 0 ? '−' : '') : ''
  return (
    <>
      {sum.atLeast && <span className="text-tiny text-muted font-normal">mind. </span>}
      {sign}
      <AnimatedNumber value={signed ? Math.abs(rounded) : rounded} />
    </>
  )
}
