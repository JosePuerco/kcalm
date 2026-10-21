// Eintragszeile nach Kern.dc.html: Name + Menge (muted), kcal rechts; Tipp = bearbeiten;
// nach links wischen zeigt „Löschen“ (SwipeRow).
import { SwipeRow } from '../../components/ui/SwipeRow.tsx'
import type { Entry } from '../../db/types.ts'
import { formatAmount, formatNumber } from '../../logic/format.ts'

type Props = {
  entry: Entry
  flash: boolean
  swiped: boolean
  /** irgendeine Zeile ist aufgewischt: ein Tipp schließt sie, statt zu bearbeiten */
  anySwiped: boolean
  onSwipe: (open: boolean) => void
  onTap: () => void
  onDelete: () => void
}

export function EntryRow({ entry, flash, swiped, anySwiped, onSwipe, onTap, onDelete }: Props) {
  const amount = entry.amount === null || entry.unit === null ? null : `${formatAmount(entry.amount)} ${entry.unit}`

  return (
    <SwipeRow
      swiped={swiped}
      anySwiped={anySwiped}
      onSwipe={onSwipe}
      onTap={onTap}
      onAction={onDelete}
      actionLabel="Löschen"
      label={`${entry.nameSnapshot}${amount ? `, ${amount}` : ''}, ${formatNumber(entry.nutrients.kcal)} kcal, bearbeiten`}
    >
      <div
        className={`text-label flex min-h-10 items-center justify-between gap-3 rounded-[8px] pr-3 ${flash ? 'flash-new' : ''}`}
      >
        <span className="min-w-0">
          {entry.nameSnapshot}
          {amount && <span className="text-muted"> {amount}</span>}
        </span>
        <span className="text-muted whitespace-nowrap">{formatNumber(entry.nutrients.kcal)}</span>
      </div>
    </SwipeRow>
  )
}
