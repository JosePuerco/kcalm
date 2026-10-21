// Leerer Tag nach Leer.dc.html: „Noch nichts eingetragen“ mit dem Vortag und den Knöpfen
// „Wie gestern“ (übernimmt den Vortag direkt) und „Tag kopieren…“ (öffnet die Auswahl).
import { Card } from '../../components/ui/Card.tsx'
import { entryCountDative } from '../../logic/diary.ts'
import { formatNumber } from '../../logic/format.ts'

type Props = {
  /** „Gestern“, wenn heute angezeigt wird, sonst „Vortag“ */
  label: string
  yesterday: { kcal: number; count: number }
  busy: boolean
  onLikeYesterday: () => void
  onCopy: () => void
}

export function EmptyDayCard({ label, yesterday, busy, onLikeYesterday, onCopy }: Props) {
  return (
    <Card padded={false} className="flex flex-col gap-1 px-4 pt-[18px] pb-4">
      <span className="text-body-large font-semibold">Noch nichts eingetragen</span>
      {yesterday.count > 0 && (
        <span className="text-secondary text-muted">
          {label}: {formatNumber(yesterday.kcal)} kcal in {entryCountDative(yesterday.count)}
        </span>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onLikeYesterday}
          disabled={busy || yesterday.count === 0}
          className="press bg-accent-soft text-accent-text rounded-field text-label min-h-[46px] text-center font-semibold disabled:opacity-40"
        >
          {label === 'Gestern' ? 'Wie gestern' : 'Wie Vortag'}
        </button>
        <button
          type="button"
          onClick={onCopy}
          disabled={busy}
          className="press bg-bg text-text rounded-field text-label min-h-[46px] text-center font-semibold disabled:opacity-40"
        >
          Tag kopieren…
        </button>
      </div>
    </Card>
  )
}
