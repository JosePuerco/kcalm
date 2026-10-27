// „Tag kopieren…“ aus Leer.dc.html. Eigenes Design (kein Prototyp, mit Jan abgestimmt): Quelltag im
// Monatskalender wählen, dann „Ganzer Tag“ oder einen einzelnen Slot in den angezeigten Tag übernehmen.
// „Einfügen in“: gleicher Slot oder alles in einen festen Slot, z. B. Abend von gestern ins Mittag (Phase 12d).
// Im Hinzufügen-Sheet („Kopieren“) ist der Ziel-Slot der dort gewählte; die Chip-Reihe fällt dann weg.
import { useState } from 'react'
import { useToday } from '../../app/diaryState.ts'
import { Chip } from '../../components/ui/Chip.tsx'
import { Sheet } from '../../components/ui/Sheet.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { copyEntries, getDayEntries } from '../../db/entries.ts'
import { useLiveQuery } from '../../db/live.ts'
import type { LocalDate, Slot } from '../../db/types.ts'
import { copiedMessage } from '../../logic/copyDay.ts'
import { addDays } from '../../logic/dates.ts'
import { dayLabel, entryCount, formatSum, slotsForDay } from '../../logic/diary.ts'
import { sumNutrients } from '../../logic/nutrients.ts'
import { MonthCalendar } from './MonthCalendar.tsx'

type Props = {
  open: boolean
  onClose: () => void
  /** Zieltag = angezeigter Tag */
  target: LocalDate
  slots: Slot[]
  completeDates: Set<LocalDate>
}

export function CopyDaySheet({ open, onClose, target, slots, completeDates }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Tag kopieren" doneLabel="Abbrechen">
      <CopyDayBody key={target} target={target} slots={slots} completeDates={completeDates} onDone={onClose} />
    </Sheet>
  )
}

type BodyProps = Omit<Props, 'open' | 'onClose'> & {
  onDone: () => void
  /** fest vorgegebener Ziel-Slot (Hinzufügen-Sheet); fehlt = Auswahl „Einfügen in“ */
  fixedSlotId?: string
}

export function CopyDayBody({ target, slots, completeDates, onDone, fixedSlotId }: BodyProps) {
  const toast = useToast()
  const today = useToday()
  const [source, setSource] = useState(addDays(target, -1))
  const [month, setMonth] = useState(source.slice(0, 7))
  const [busy, setBusy] = useState(false)
  // undefined = gleicher Slot
  const [chosenSlotId, setTargetSlotId] = useState<string | undefined>(undefined)
  const targetSlotId = fixedSlotId ?? chosenSlotId
  const entries = useLiveQuery(() => getDayEntries(source), [source])
  const label = dayLabel(source, today)

  const copy = async (slotId?: string) => {
    setBusy(true)
    try {
      const copies = await copyEntries(source, target, { slotId, targetSlotId })
      toast(copiedMessage(copies.length))
      onDone()
    } catch (error) {
      console.error(error)
      toast('Kopieren fehlgeschlagen')
      setBusy(false)
    }
  }

  const bySlot = entries ? slotsForDay(slots, entries).filter((s) => s.entries.length > 0) : []
  const total = entries ? sumNutrients(entries.map((e) => e.nutrients)).kcal : null
  const targets = slots.filter((s) => s.deletedAt === null && !s.archived).sort((a, b) => a.order - b.order)

  return (
    <div className="scroll-area px-screen-x gap-card-gap flex flex-col pt-1 pb-[calc(24px+env(safe-area-inset-bottom))]">
      <MonthCalendar
        month={month}
        selected={source}
        today={today}
        completeDates={completeDates}
        onMonth={setMonth}
        onPick={setSource}
      />
      {fixedSlotId === undefined && (
        <div className="flex flex-col gap-1.5">
          <span className="text-small text-muted px-1 tracking-[0.6px] uppercase">Einfügen in</span>
          {/* Reihe läuft bis zum Rand, wie die Slot-Chips im Hinzufügen-Sheet */}
          <div className="-mx-screen-x px-screen-x flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            <Chip active={targetSlotId === undefined} onClick={() => setTargetSlotId(undefined)}>
              Gleicher Slot
            </Chip>
            {targets.map((s) => (
              <Chip key={s.id} active={targetSlotId === s.id} onClick={() => setTargetSlotId(s.id)}>
                {s.name}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <span className="text-small text-muted px-1 pt-1 tracking-[0.6px] uppercase">
        Von {label.date}
        {label.relative ? ` · ${label.relative}` : ''}
      </span>
      {source === target ? (
        <p className="text-label text-muted px-1">Wähle einen anderen Tag als den angezeigten.</p>
      ) : entries && entries.length === 0 ? (
        <p className="text-label text-muted px-1">An diesem Tag ist nichts eingetragen.</p>
      ) : (
        <div className="bg-card rounded-card overflow-hidden">
          {entries && total && (
            <CopyRow
              title="Ganzer Tag"
              meta={`${entryCount(entries.length)} · ${formatSum(total)} kcal`}
              disabled={busy}
              onClick={() => void copy()}
            />
          )}
          {bySlot.map((s) => (
            <CopyRow
              key={s.slot.id}
              title={s.slot.name}
              meta={`${entryCount(s.entries.length)} · ${formatSum(s.kcal)} kcal`}
              disabled={busy}
              onClick={() => void copy(s.slot.id)}
              border
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CopyRow({ title, meta, disabled, onClick, border }: { title: string; meta: string; disabled: boolean; onClick: () => void; border?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-2.5 px-4 py-2 text-left disabled:opacity-40 ${border ? 'border-line border-t' : ''}`}
    >
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-body font-medium">{title}</span>
        <span className="text-small text-muted">{meta}</span>
      </span>
      <span className="text-secondary text-accent-text font-semibold">Übernehmen</span>
    </button>
  )
}
