// Slot-Karte nach Kern.dc.html: Chevron, Name, eingeklappt „2 Einträge“ bzw. „leer“, kcal rechts, „+“;
// aufgeklappt die Einträge mit Trennlinien (EntryRow: Tipp bearbeitet, Wischen löscht).
import { IconChevronRight, IconPlus } from '../../components/icons/icons.tsx'
import { Reveal } from '../../components/ui/Reveal.tsx'
import type { Entry } from '../../db/types.ts'
import { entryCount, formatSum, type DaySlot } from '../../logic/diary.ts'
import { EntryRow } from './EntryRow.tsx'

type Props = {
  day: DaySlot
  open: boolean
  /** Eintrag, der nach dem Hinzufügen kurz aufblinkt */
  flashId: string | null
  /** aufgewischte Zeile (höchstens eine im ganzen Tag) */
  swipedId: string | null
  onSwipe: (entryId: string | null) => void
  onEdit: (entry: Entry) => void
  onDelete: (entry: Entry) => void
  onToggle: () => void
  onAdd: () => void
}

export function SlotCard({ day, open, flashId, swipedId, onSwipe, onEdit, onDelete, onToggle, onAdd }: Props) {
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
            <EntryRow
              key={e.id}
              entry={e}
              flash={e.id === flashId}
              swiped={e.id === swipedId}
              anySwiped={swipedId !== null}
              onSwipe={(isOpen) => onSwipe(isOpen ? e.id : null)}
              onTap={() => onEdit(e)}
              onDelete={() => onDelete(e)}
            />
          ))}
        </Reveal>
      )}
    </div>
  )
}
