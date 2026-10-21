// Hinzufügen-Sheet nach Kern.dc.html: Slot-Chips oben, dann Such-Schritt → Mengen-Schritt.
// Nach dem Hinzufügen bleibt das Sheet offen (Toast als Bestätigung), „Fertig“ schließt.
// Bearbeiten (Tipp auf einen Eintrag): Mengen-Schritt mit „Speichern“ + „Löschen“; Verschieben über die
// Slot-Chips und die Tageszeile darunter (Tageszeile ist eine Ergänzung zum Prototyp, mit Jan abgestimmt).
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import {
  closeAddSheet,
  showNewEntry,
  useAddSheet,
  useDiaryState,
  useToday,
} from '../../app/diaryState.ts'
import { IconChevronDown } from '../../components/icons/icons.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Chip } from '../../components/ui/Chip.tsx'
import { Sheet } from '../../components/ui/Sheet.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { useBls } from '../../data/bls.ts'
import { addEntry, deleteEntry, getEntry, loadFoodSources, updateEntry } from '../../db/entries.ts'
import { useLiveQuery } from '../../db/live.ts'
import { getSlots } from '../../db/slots.ts'
import type { Entry, LocalDate, Slot } from '../../db/types.ts'
import {
  addedMessage,
  amountToKeypad,
  canEditAsFood,
  choiceFromEntry,
  editedEntry,
  foodEntry,
  initialAmount,
  type FoodChoice,
} from '../../logic/addFood.ts'
import { dayLabel } from '../../logic/diary.ts'
import { formatTime } from '../../logic/format.ts'
import { parseKeypadValue } from '../../logic/keypad.ts'
import {
  editedQuick,
  emptyQuick,
  quickEntry,
  quickFromEntry,
  validateQuick,
  type QuickValues,
} from '../../logic/quickEntry.ts'
import { slotForTime } from '../../logic/slots.ts'
import { instant, motionTokens, useReduced } from '../../motion/motion.ts'
import { MonthCalendar } from '../tagebuch/MonthCalendar.tsx'
import { AmountStep } from './AmountStep.tsx'
import { QuickStep } from './QuickStep.tsx'
import { SearchStep } from './SearchStep.tsx'
import { useFoodResolver } from './useFoodResolver.ts'

const NO_DATES = new Set<LocalDate>()

export function AddSheet() {
  const sheet = useAddSheet()
  const slots = useLiveQuery(getSlots, [])
  // Zu bearbeitender Eintrag; null = gelöscht oder nicht gefunden
  const editing = useLiveQuery(
    () => (sheet.editId ? getEntry(sheet.editId).catch(() => null) : Promise.resolve(null)),
    [sheet.editId],
  )
  // Die Live-Abfrage hält ihren letzten Wert, bis die neue Antwort da ist: nur ein Eintrag zur aktuellen
  // editId zählt, sonst öffnet „+“ nach einem Bearbeiten noch den alten Eintrag
  const current = sheet.editId !== null && editing?.id === sheet.editId ? editing : null
  const ready = slots && (sheet.editId === null || current !== null || editing === null)
  // Nicht bearbeitbare oder gelöschte Einträge: Sheet bleibt leer statt abzustürzen
  const editable = current && (canEditAsFood(current) || current.kind === 'quick') ? current : null
  // Kopf des Sheets; der Schnelleintrag hat eigenen Titel und Zurück-Pfeil (Schnell.dc.html)
  const [header, setHeader] = useState<Header | null>(null)
  return (
    <Sheet
      open={sheet.open}
      onClose={closeAddSheet}
      title={header?.title ?? (sheet.editId ? 'Bearbeiten' : 'Hinzufügen')}
      onBack={header?.onBack}
    >
      {/* Inhalt erst mit Slots: dann stimmt die Vorauswahl; jedes Öffnen beginnt frisch */}
      {ready && (sheet.editId === null || editable) && (
        <AddFlow
          key={sheet.editId ?? 'neu'}
          slots={slots}
          initialSlotId={sheet.slotId}
          editing={editable}
          onHeader={setHeader}
        />
      )}
    </Sheet>
  )
}

type Header = { title: string; onBack?: () => void }

type Step =
  | { kind: 'search' }
  | { kind: 'amount'; food: FoodChoice }
  | { kind: 'quick' }
  | { kind: 'edit'; entry: Entry }
  | { kind: 'date'; entry: Entry }

type FlowProps = {
  slots: Slot[]
  initialSlotId: string | null
  editing: Entry | null
  onHeader: (header: Header | null) => void
}

function AddFlow({ slots, initialSlotId, editing, onHeader }: FlowProps) {
  const toast = useToast()
  const reduced = useReduced()
  const today = useToday()
  const viewed = useDiaryState().date ?? today
  const sources = useLiveQuery(loadFoodSources, [])
  const bls = useBls()
  const blsData = bls.status === 'ready' ? bls.data : null
  const resolver = useFoodResolver(sources, blsData)

  const [slotId, setSlotId] = useState(() => {
    if (editing) return editing.slotId
    if (initialSlotId && slots.some((s) => s.id === initialSlotId)) return initialSlotId
    return slotForTime(slots, formatTime(new Date()))?.id ?? null
  })
  const [date, setDate] = useState<LocalDate>(editing?.date ?? viewed)
  const [step, setStep] = useState<Step>(editing ? { kind: 'edit', entry: editing } : { kind: 'search' })
  const [query, setQuery] = useState('')
  const [amount, setAmount] = useState(editing?.amount ? amountToKeypad(editing.amount) : '')
  const [calendarMonth, setCalendarMonth] = useState(date.slice(0, 7))
  const [busy, setBusy] = useState(false)
  const [quick, setQuick] = useState<QuickValues>(() => (editing?.kind === 'quick' ? quickFromEntry(editing) : emptyQuick()))
  const [quickError, setQuickError] = useState<string | null>(null)

  const inQuick = step.kind === 'quick'
  useEffect(() => {
    onHeader(inQuick ? { title: 'Schnelleintrag', onBack: () => setStep({ kind: 'search' }) } : null)
  }, [inQuick, onHeader])
  // Beim Schließen den Kopf zurücksetzen, damit das nächste Öffnen mit „Hinzufügen“ beginnt
  useEffect(() => () => onHeader(null), [onHeader])
  // Beim Bearbeiten eines Eintrags in einem archivierten Slot ist kein Chip aktiv; Speichern behält den Slot
  const slot = slots.find((s) => s.id === slotId) ?? (editing ? undefined : slots[0])

  const pick = (food: FoodChoice) => {
    setAmount(amountToKeypad(initialAmount(food)))
    setStep({ kind: 'amount', food })
  }

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      console.error(error)
      toast('Speichern fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  const add = (food: FoodChoice) =>
    run(async () => {
      const value = parseKeypadValue(amount)
      if (!slot || value === null || value <= 0) return
      const entry = await addEntry(foodEntry(food, value, viewed, slot.id))
      showNewEntry(slot.id, entry.id)
      toast(addedMessage(food.name, entry.nutrients.kcal, slot.name))
      // Im Sheet bleiben: zurück zur Suche für das nächste Lebensmittel
      setQuery('')
      setStep({ kind: 'search' })
    })

  const addQuick = () =>
    run(async () => {
      const check = validateQuick(quick)
      if (!slot) return
      if (!check.ok) return setQuickError(check.error)
      setQuickError(null)
      const entry = await addEntry(quickEntry(quick, viewed, slot.id))
      showNewEntry(slot.id, entry.id)
      toast(addedMessage(entry.nameSnapshot, entry.nutrients.kcal, slot.name))
      // Im Sheet bleiben wie beim Lebensmittel
      setQuick(emptyQuick())
      setStep({ kind: 'search' })
    })

  const saveQuick = (entry: Entry) =>
    run(async () => {
      const check = validateQuick(quick)
      if (!check.ok) return setQuickError(check.error)
      const target = slot?.id ?? entry.slotId
      await updateEntry(entry.id, editedQuick(quick, date, target))
      showNewEntry(target, entry.id)
      toast(`${check.changes.nameSnapshot} gespeichert`)
      closeAddSheet()
    })

  const save = (entry: Entry, food: FoodChoice) =>
    run(async () => {
      const value = parseKeypadValue(amount)
      const target = slot?.id ?? entry.slotId
      if (value === null || value <= 0) return
      await updateEntry(entry.id, editedEntry(food, value, date, target))
      showNewEntry(target, entry.id)
      toast(`${entry.nameSnapshot} gespeichert`)
      closeAddSheet()
    })

  const remove = (entry: Entry) =>
    run(async () => {
      await deleteEntry(entry.id)
      toast(`${entry.nameSnapshot} gelöscht`)
      closeAddSheet()
    })

  const editingNow = step.kind === 'edit' || step.kind === 'date'
  const label = dayLabel(date, today)

  return (
    <>
      <div className="flex gap-1.5 overflow-x-auto px-4 pt-1 pb-2.5 [scrollbar-width:none]">
        {slots.map((s) => (
          <Chip key={s.id} active={s.id === slot?.id} onClick={() => setSlotId(s.id)}>
            {s.name}
          </Chip>
        ))}
      </div>
      {editingNow && (
        <button
          type="button"
          onClick={() => setStep(step.kind === 'date' ? { kind: 'edit', entry: step.entry } : { kind: 'date', entry: step.entry })}
          aria-expanded={step.kind === 'date'}
          className="text-label text-muted min-h-touch-min -mt-1.5 flex items-center gap-1.5 self-start px-4"
        >
          Tag: <span className="text-text font-semibold">{label.date}</span>
          {label.relative && <span>· {label.relative}</span>}
          <IconChevronDown style={{ transform: step.kind === 'date' ? 'rotate(180deg)' : 'none' }} />
        </button>
      )}
      <motion.div
        key={step.kind === 'amount' ? step.food.ref : step.kind}
        className="flex min-h-0 flex-1 flex-col"
        initial={reduced ? false : { opacity: 0, x: motionTokens.sheetStepOffsetX }}
        animate={{ opacity: 1, x: 0 }}
        transition={reduced ? instant : motionTokens.sheetStep}
      >
        {step.kind === 'search' &&
          sources && (
            <SearchStep
              query={query}
              onQuery={setQuery}
              sources={sources}
              bls={blsData}
              resolver={resolver}
              onPick={pick}
              onQuick={() => setStep({ kind: 'quick' })}
            />
          )}

        {step.kind === 'quick' && (
          <QuickStep
            values={quick}
            onChange={setQuick}
            error={quickError}
            confirmLabel={`Zu ${slot?.name ?? ''} hinzufügen`}
            onConfirm={() => void addQuick()}
            busy={busy}
          />
        )}

        {step.kind === 'amount' && (
          <AmountStep
            food={step.food}
            amount={amount}
            onAmount={setAmount}
            onBack={() => setStep({ kind: 'search' })}
            confirmLabel={`Zu ${slot?.name ?? ''} hinzufügen`}
            onConfirm={() => void add(step.food)}
            busy={busy}
          />
        )}

        {step.kind === 'edit' && step.entry.kind === 'quick' && (
          <QuickStep
            values={quick}
            onChange={setQuick}
            error={quickError}
            confirmLabel="Speichern"
            onConfirm={() => void saveQuick(step.entry)}
            busy={busy}
            secondary={
              <Button variant="danger" disabled={busy} onClick={() => void remove(step.entry)}>
                Löschen
              </Button>
            }
          />
        )}

        {step.kind === 'edit' && step.entry.kind !== 'quick' && (
          <EditStep
            food={choiceFromEntry(step.entry, step.entry.ref ? resolver.resolve(step.entry.ref) : undefined)}
            amount={amount}
            onAmount={setAmount}
            busy={busy}
            onSave={(food) => void save(step.entry, food)}
            onDelete={() => void remove(step.entry)}
          />
        )}

        {step.kind === 'date' && (
          <div className="scroll-area px-screen-x">
            <MonthCalendar
              month={calendarMonth}
              selected={date}
              today={today}
              completeDates={NO_DATES}
              onMonth={setCalendarMonth}
              onPick={(picked) => {
                setDate(picked)
                setStep({ kind: 'edit', entry: step.entry })
              }}
            />
          </div>
        )}
      </motion.div>
    </>
  )
}

type EditProps = {
  food: FoodChoice
  amount: string
  onAmount: (amount: string) => void
  busy: boolean
  onSave: (food: FoodChoice) => void
  onDelete: () => void
}

function EditStep({ food, amount, onAmount, busy, onSave, onDelete }: EditProps) {
  return (
    <AmountStep
      food={food}
      amount={amount}
      onAmount={onAmount}
      // Zurück verwirft die Änderung und schließt (im Prototyp ginge es zur Suche)
      onBack={closeAddSheet}
      confirmLabel="Speichern"
      onConfirm={() => onSave(food)}
      busy={busy}
      secondary={
        <Button variant="danger" disabled={busy} onClick={onDelete}>
          Löschen
        </Button>
      }
    />
  )
}
