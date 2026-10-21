// Leerer Tag nach Leer.dc.html: „Noch nichts eingetragen“ mit dem Vortag. Die Knöpfe „Wie gestern“
// und „Tag kopieren…“ kommen in Teilschritt 3g.
import { Card } from '../../components/ui/Card.tsx'
import { entryCount } from '../../logic/diary.ts'
import { formatNumber } from '../../logic/format.ts'

/** label: „Gestern“, wenn heute angezeigt wird, sonst „Vortag“ */
export function EmptyDayCard({ label, yesterday }: { label: string; yesterday: { kcal: number; count: number } }) {
  return (
    <Card padded={false} className="flex flex-col gap-1 px-4 pt-[18px] pb-4">
      <span className="text-body-large font-semibold">Noch nichts eingetragen</span>
      {yesterday.count > 0 && (
        <span className="text-secondary text-muted">
          {label}: {formatNumber(yesterday.kcal)} kcal in {entryCount(yesterday.count)}
        </span>
      )}
    </Card>
  )
}
