// Hinzufügen-Sheet nach Kern.dc.html: Slot-Chips oben, dann Such-Schritt → Mengen-Schritt.
// Nach dem Hinzufügen bleibt das Sheet offen (Toast als Bestätigung), „Fertig“ schließt.
// Bearbeiten (Tipp auf einen Eintrag): Mengen-Schritt mit „Speichern“ + „Löschen“; Verschieben über die
// Slot-Chips und die Tageszeile darunter (Tageszeile ist eine Ergänzung zum Prototyp, mit Jan abgestimmt).
// Mahlzeiten (Mahlzeit.dc.html) und Rezepte über die Knöpfe unter dem Suchfeld oder die Suche.
import { motion } from 'motion/react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  closeAddSheet,
  showNewEntry,
  useAddSheet,
  useDiaryState,
  useToday,
  type ScanStart,
} from '../../app/diaryState.ts'
import { href, navigate } from '../../app/router.ts'
import { IconChevronDown } from '../../components/icons/icons.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Chip } from '../../components/ui/Chip.tsx'
import { Overlay } from '../../components/ui/overlay.tsx'
import { Sheet } from '../../components/ui/Sheet.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { useBls } from '../../data/bls.ts'
import { getCompleteDates } from '../../db/days.ts'
import { addEntries, addEntry, deleteEntry, getEntry, loadFoodSources, updateEntry } from '../../db/entries.ts'
import { saveOffProduct } from '../../db/off.ts'
import { resolvePendingScan } from '../../db/pendingScans.ts'
import { useLiveQuery } from '../../db/live.ts'
import { getSlots } from '../../db/slots.ts'
import type { Entry, LocalDate, Meal, Slot } from '../../db/types.ts'
import {
  addedMessage,
  canEditAsFood,
  choiceFromEntry,
  choiceFromProduct,
  editedEntry,
  foodEntry,
  needsCheck,
  type FoodChoice,
} from '../../logic/addFood.ts'
import { dayLabel } from '../../logic/diary.ts'
import { formatTime } from '../../logic/format.ts'
import { buildMealRows, buildRecipeRows } from '../../logic/groupList.ts'
import { mealEntries, type MealLine } from '../../logic/meal.ts'
import { sumNutrients } from '../../logic/nutrients.ts'
import {
  editedQuick,
  emptyQuick,
  quickEntry,
  quickFromEntry,
  validateQuick,
  type QuickValues,
} from '../../logic/quickEntry.ts'
import type { OffProduct } from '../../logic/off.ts'
import {
  EMPTY_INPUT,
  inputAmount,
  inputFromEntry,
  inputPortionLabel,
  type AmountInput,
} from '../../logic/portionCount.ts'
import { productToForm, type ProductFormValues } from '../../logic/productForm.ts'
import { slotForTime } from '../../logic/slots.ts'
import { instant, motionTokens, useReduced } from '../../motion/motion.ts'
import { ProductForm } from '../lebensmittel/ProductForm.tsx'
import { CopyDayBody } from '../tagebuch/CopyDaySheet.tsx'
import { MonthCalendar } from '../tagebuch/MonthCalendar.tsx'
import { AmountStep } from './AmountStep.tsx'
import { CheckStep } from './CheckStep.tsx'
import { GroupListStep } from './GroupListStep.tsx'
import { MealStep } from './MealStep.tsx'
import { QuickStep } from './QuickStep.tsx'
import { SearchStep } from './SearchStep.tsx'
import { useFoodResolver } from './useFoodResolver.ts'

const NO_DATES = new Set<LocalDate>()

// Scanner samt Decoder erst laden, wenn er gebraucht wird
const ScanFlow = lazy(() => import('../scan/ScanFlow.tsx'))

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
          key={sheet.editId ?? sheet.scan?.scanId ?? 'neu'}
          slots={slots}
          initialSlotId={sheet.slotId}
          editing={editable}
          scan={sheet.scan}
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
  /** Prüf-Dialog vor der Menge (ungeprüftes OFF-Produkt) */
  | { kind: 'check'; food: FoodChoice }
  | { kind: 'quick' }
  | { kind: 'meals' }
  | { kind: 'recipes' }
  /** Von einem anderen Tag in den gewählten Slot kopieren (Phase 12d) */
  | { kind: 'copy' }
  /** from: wohin Zurück führt */
  | { kind: 'meal'; meal: Meal; from: 'search' | 'meals' }
  | { kind: 'edit'; entry: Entry }
  | { kind: 'date'; entry: Entry }

type FlowProps = {
  slots: Slot[]
  initialSlotId: string | null
  editing: Entry | null
  scan: ScanStart | null
  onHeader: (header: Header | null) => void
}

function AddFlow({ slots, initialSlotId, editing, scan, onHeader }: FlowProps) {
  const toast = useToast()
  const reduced = useReduced()
  const today = useToday()
  const viewed = useDiaryState().date ?? today
  const sources = useLiveQuery(loadFoodSources, [])
  const completeDates = useLiveQuery(getCompleteDates, [])
  const bls = useBls()
  const blsData = bls.status === 'ready' ? bls.data : null
  const resolver = useFoodResolver(sources, blsData)

  const [slotId, setSlotId] = useState(() => {
    if (editing) return editing.slotId
    if (initialSlotId && slots.some((s) => s.id === initialSlotId)) return initialSlotId
    return slotForTime(slots, formatTime(new Date()))?.id ?? null
  })
  const [date, setDate] = useState<LocalDate>(editing?.date ?? viewed)
  const [step, setStep] = useState<Step>(() => {
    if (editing) return { kind: 'edit', entry: editing }
    if (!scan?.food) return { kind: 'search' }
    return needsCheck(scan.food) ? { kind: 'check', food: scan.food } : { kind: 'amount', food: scan.food }
  })
  const [query, setQuery] = useState('')
  // Neue Einträge starten leer (Jan, 27.10.2026); beim Bearbeiten ggf. wieder als Anzahl Portionen
  const [input, setInput] = useState<AmountInput>(() =>
    editing?.amount ? inputFromEntry(editing.amount, editing.portionLabel) : EMPTY_INPUT,
  )
  // Gemerkter Scan: gilt als erledigt, sobald er eingetragen ist
  const [pendingScanId, setPendingScanId] = useState(scan?.scanId ?? null)
  // Produkt anlegen für einen gemerkten Scan, der bei OFF fehlt oder ohne kcal ist
  const [form, setForm] = useState<ProductFormValues | null>(scan?.create ?? null)
  const [calendarMonth, setCalendarMonth] = useState(date.slice(0, 7))
  const [busy, setBusy] = useState(false)
  const [quick, setQuick] = useState<QuickValues>(() => (editing?.kind === 'quick' ? quickFromEntry(editing) : emptyQuick()))
  const [quickError, setQuickError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  // Kopf des Sheets: eigene Titel mit Zurück-Pfeil für Schnelleintrag, Listen und Mahlzeit
  const header = useMemo<Header | null>(() => {
    const toSearch = () => setStep({ kind: 'search' })
    if (step.kind === 'quick') return { title: 'Schnelleintrag', onBack: toSearch }
    if (step.kind === 'meals') return { title: 'Mahlzeiten', onBack: toSearch }
    if (step.kind === 'recipes') return { title: 'Rezepte', onBack: toSearch }
    if (step.kind === 'copy') return { title: 'Kopieren', onBack: toSearch }
    if (step.kind === 'meal') {
      const back = step.from
      return { title: step.meal.name, onBack: () => setStep(back === 'meals' ? { kind: 'meals' } : { kind: 'search' }) }
    }
    return null
  }, [step])
  useEffect(() => onHeader(header), [header, onHeader])
  // Beim Schließen den Kopf zurücksetzen, damit das nächste Öffnen mit „Hinzufügen“ beginnt
  useEffect(() => () => onHeader(null), [onHeader])
  // Beim Bearbeiten eines Eintrags in einem archivierten Slot ist kein Chip aktiv; Speichern behält den Slot
  const slot = slots.find((s) => s.id === slotId) ?? (editing ? undefined : slots[0])

  // Scan und Auswahl aus der Suche: ungeprüfte OFF-Produkte erst prüfen, dann Menge
  const pick = (food: FoodChoice) => {
    setInput(EMPTY_INPUT)
    setStep(needsCheck(food) ? { kind: 'check', food } : { kind: 'amount', food })
  }
  // Aktuelle Werte (z. B. nach einer Korrektur im Prüf-Dialog); frisch gespeicherte OFF-Treffer
  // sind evtl. noch nicht in den Quellen
  const live = (food: FoodChoice) => resolver.resolve(food.ref) ?? food

  // OFF-Suchtreffer: lokal speichern, dann Menge; ohne kcal erst das Formular (wie beim Scan)
  const pickOff = (product: OffProduct) => {
    if (product.per100.kcal === null) return setForm(productToForm(product))
    void run(async () => pick(choiceFromProduct(await saveOffProduct(product))))
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
      const value = inputAmount(input)
      if (!slot || value === null || value <= 0) return
      const entry = await addEntry(foodEntry(food, value, viewed, slot.id, inputPortionLabel(food, input)))
      if (pendingScanId) {
        await resolvePendingScan(pendingScanId)
        setPendingScanId(null)
      }
      showNewEntry(slot.id, entry.id)
      toast(addedMessage(food.name, entry.nutrients.kcal, slot.name))
      // Im Sheet bleiben: zurück zur Suche für das nächste Lebensmittel
      setQuery('')
      setStep({ kind: 'search' })
    })

  const addMeal = (meal: Meal, lines: MealLine[], scale: number) =>
    run(async () => {
      if (!slot) return
      const entries = await addEntries(mealEntries(meal, lines, scale, viewed, slot.id, crypto.randomUUID()))
      const first = entries[0]
      if (first) showNewEntry(slot.id, first.id)
      toast(addedMessage(meal.name, sumNutrients(entries.map((e) => e.nutrients)).kcal.value, slot.name))
      // Im Sheet bleiben wie beim Lebensmittel
      setQuery('')
      setStep({ kind: 'search' })
    })

  // Zum Anlegen oder Bearbeiten einer Vorlage das Sheet schließen und zu Lebensmittel wechseln
  const goTo = (...path: string[]) => {
    closeAddSheet()
    navigate(href('lebensmittel', ...path))
  }

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
      const value = inputAmount(input)
      const target = slot?.id ?? entry.slotId
      if (value === null || value <= 0) return
      await updateEntry(entry.id, editedEntry(food, value, date, target, inputPortionLabel(food, input)))
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
        key={
          step.kind === 'amount' || step.kind === 'check'
            ? `${step.kind}:${step.food.ref}`
            : step.kind === 'meal'
              ? `meal:${step.meal.id}`
              : step.kind
        }
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
              onScan={() => setScanning(true)}
              onPickOff={pickOff}
              onMeals={() => setStep({ kind: 'meals' })}
              onRecipes={() => setStep({ kind: 'recipes' })}
              onCopy={() => setStep({ kind: 'copy' })}
              onPickMeal={(meal) => setStep({ kind: 'meal', meal, from: 'search' })}
            />
          )}

        {step.kind === 'copy' && slot && completeDates && (
          <CopyDayBody
            target={viewed}
            slots={slots}
            completeDates={completeDates}
            fixedSlotId={slot.id}
            onDone={closeAddSheet}
          />
        )}

        {step.kind === 'meals' && sources && (
          <GroupListStep
            rows={buildMealRows(sources.meals, resolver.resolve).filter((r) => !r.archived)}
            empty="Noch keine Mahlzeiten. Eine Mahlzeit ist eine Gruppe von Lebensmitteln mit Standardmengen."
            createLabel="Mahlzeit anlegen"
            onCreate={() => goTo('mahlzeit', 'neu')}
            onPick={(id) => {
              const meal = sources.meals.find((m) => m.id === id)
              if (meal) setStep({ kind: 'meal', meal, from: 'meals' })
            }}
          />
        )}

        {step.kind === 'recipes' && sources && (
          <GroupListStep
            rows={buildRecipeRows(sources.recipes, resolver.resolve).filter((r) => !r.archived)}
            // Nicht rechenbar (z. B. BLS lädt noch): nicht wählbar
            disabled={(row) => !resolver.resolve(`recipe:${row.id}`)}
            empty="Noch keine Rezepte. Ein Rezept rechnet pro 100 g über das Endgewicht nach dem Kochen."
            createLabel="Rezept anlegen"
            onCreate={() => goTo('rezept', 'neu')}
            onPick={(id) => {
              const food = resolver.resolve(`recipe:${id}`)
              if (food) pick(food)
            }}
          />
        )}

        {step.kind === 'meal' && (
          <MealStep
            meal={step.meal}
            resolve={resolver.resolve}
            slotName={slot?.name ?? ''}
            busy={busy}
            onAdd={(lines, scale) => void addMeal(step.meal, lines, scale)}
            onEditTemplate={() => goTo('mahlzeit', step.meal.id)}
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

        {step.kind === 'check' && (
          <CheckStep
            food={step.food}
            onBack={() => setStep({ kind: 'search' })}
            onDone={() => setStep({ kind: 'amount', food: step.food })}
          />
        )}

        {step.kind === 'amount' && (
          <AmountStep
            food={live(step.food)}
            input={input}
            onInput={setInput}
            onBack={() => setStep({ kind: 'search' })}
            confirmLabel={`Zu ${slot?.name ?? ''} hinzufügen`}
            onConfirm={() => void add(live(step.food))}
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
            input={input}
            onInput={setInput}
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

      {form && (
        <Overlay>
          <div className="bg-bg absolute inset-0 z-10 flex flex-col">
            <ProductForm
              initial={form}
              onBack={() => setForm(null)}
              onSaved={(product) => {
                setForm(null)
                pick(choiceFromProduct(product))
              }}
            />
          </div>
        </Overlay>
      )}

      {scanning && (
        <Overlay>
          <Suspense fallback={<div className="bg-scanner-bg absolute inset-0 z-10" />}>
            <ScanFlow
              slot={slot}
              date={viewed}
              today={today}
              resolver={resolver}
              onPick={(food) => {
                setScanning(false)
                pick(food)
              }}
              onQuick={() => {
                setScanning(false)
                setStep({ kind: 'quick' })
              }}
              onClose={() => setScanning(false)}
              onLater={closeAddSheet}
            />
          </Suspense>
        </Overlay>
      )}
    </>
  )
}

type EditProps = {
  food: FoodChoice
  input: AmountInput
  onInput: (input: AmountInput) => void
  busy: boolean
  onSave: (food: FoodChoice) => void
  onDelete: () => void
}

function EditStep({ food, input, onInput, busy, onSave, onDelete }: EditProps) {
  return (
    <AmountStep
      food={food}
      input={input}
      onInput={onInput}
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
