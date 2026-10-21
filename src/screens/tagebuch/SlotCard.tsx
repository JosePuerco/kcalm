// Slot-Karte nach Kern.dc.html: Chevron, Name, eingeklappt „2 Einträge“ bzw. „leer“, kcal rechts, „+“;
// aufgeklappt die Einträge mit Trennlinien. Bearbeiten und Wischen zum Löschen folgen in 3d.
import { IconChevronRight, IconPlus } from '../../components/icons/icons.tsx'
import { Reveal } from '../../components/ui/Reveal.tsx'
import type { Entry } from '../../db/types.ts'
import { entryCount, formatSum, type DaySlot } from '../../logic/diary.ts'
import { formatAmount, formatNumber } from '../../logic/format.ts'

type Props = {
  day: DaySlot
  open: boolean
  onToggle: () => void
  onAdd: () => void
}

export function SlotCard({ day, open, onToggle, onAdd }: Props) {
  const { slot, entries, kcal } = day
  const count = entries.length === 0 ? 'leer' : open ? '' : entryCount(entries.length)
  return (
    <div className="bg-card rounded-card overflow-hidden pr-1.5 pl-3">
      <div className="flex items-center">
        <button
          type="button"
          onClick={onToggle}
          disabled={entries.length === 0}
          aria-expanded={entries.length > 0 ? open : undefined}
          className="flex min-h-[50px] min-w-0 flex-1 items-center gap-2 text-left"
        >
          <IconChevronRight
            className="text-muted shrink-0"
            style={{
              transform: open ? 'rotate(90deg)' : 'none',
              transition: 'transform var(--kc-motion-chevron-duration) var(--kc-motion-chevron-easing)',
            }}
          />
          <span className="text-body truncate font-semibold">{slot.name}</span>
          <span className="text-secondary text-muted whitespace-nowrap">{count}</span>
          <span className="text-label text-muted ml-auto pl-2 whitespace-nowrap">{formatSum(kcal)} kcal</span>
        </button>
        <button
          type="button"
          aria-label={`Zu ${slot.name} hinzufügen`}
          onClick={onAdd}
          className="press text-accent-text flex size-11 shrink-0 items-center justify-center"
        >
          <IconPlus size={20} strokeWidth={2} />
        </button>
      </div>
      {open && entries.length > 0 && (
        <Reveal className="pb-1.5 pl-3">
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} />
          ))}
        </Reveal>
      )}
    </div>
  )
}

function EntryRow({ entry }: { entry: Entry }) {
  const amount = entry.amount === null || entry.unit === null ? null : `${formatAmount(entry.amount)} ${entry.unit}`
  return (
    <div className="border-line border-t">
      <div className="text-label flex min-h-10 items-center justify-between gap-3 pr-3">
        <span className="min-w-0">
          {entry.nameSnapshot}
          {amount && <span className="text-muted"> {amount}</span>}
        </span>
        <span className="text-muted whitespace-nowrap">{formatNumber(entry.nutrients.kcal)}</span>
      </div>
    </div>
  )
}
