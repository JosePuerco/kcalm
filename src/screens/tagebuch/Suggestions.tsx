// Vorschläge aus Fitboard (PLAN.md Phase 16, kein Prototyp, mit Jan abgestimmt am 20.11.2026):
// Zeile „3 Vorschläge aus Fitboard“ über den Slots wie bei den gemerkten Scans; Tipp öffnet das Sheet.
// Je Foto bzw. Nachricht eine Gruppe mit „Alle übernehmen“; Tipp auf einen Teil → Mengen-Schritt, zurück in die
// Gruppe; Wischen nimmt einen Teil heraus bzw. lehnt die Gruppe oder einen Einzelvorschlag ab.
// Nichts landet ohne Jans Tipp im Tagebuch.
import { useEffect, useMemo, useState } from 'react'
import { showNewEntry } from '../../app/diaryState.ts'
import { IconChevronRight } from '../../components/icons/icons.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { Sheet } from '../../components/ui/Sheet.tsx'
import { SwipeRow } from '../../components/ui/SwipeRow.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { useBls } from '../../data/bls.ts'
import { loadFoodSources } from '../../db/entries.ts'
import { acceptSuggestions, loadSuggestions, rejectSuggestions } from '../../db/inbox.ts'
import { useLiveQuery } from '../../db/live.ts'
import type { LocalDate, Slot } from '../../db/types.ts'
import type { FoodChoice } from '../../logic/addFood.ts'
import { formatAmount, formatNumber } from '../../logic/format.ts'
import {
  bestMatch,
  estimateFood,
  resolvePart,
  scaleEstimate,
  slotIdFor,
  suggestionCountLabel,
  suggestionEntries,
  type ResolvedPart,
  type Suggestion,
  type SuggestionGroup,
} from '../../logic/inbox.ts'
import { EMPTY_INPUT, inputAmount, inputFromEntry, type AmountInput } from '../../logic/portionCount.ts'
import { AmountStep } from '../add/AmountStep.tsx'
import { useFoodResolver } from '../add/useFoodResolver.ts'

export function SuggestionsRow({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="press w-full text-left">
      <Card padded={false} className="flex min-h-[60px] items-center gap-2.5 px-4 py-2">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-body font-semibold">{suggestionCountLabel(count)}</span>
          <span className="text-small text-muted">Übernehmen oder ablehnen</span>
        </span>
        <IconChevronRight className="text-muted shrink-0" />
      </Card>
    </button>
  )
}

type View =
  | { kind: 'list' }
  | { kind: 'edit'; item: Suggestion; group: SuggestionGroup; food: FoodChoice }
  | { kind: 'slot'; group: SuggestionGroup }

type SheetProps = { open: boolean; onClose: () => void; date: LocalDate; today: LocalDate; slots: Slot[] }

export function SuggestionsSheet({ open, onClose, date, today, slots }: SheetProps) {
  const toast = useToast()
  const groups = useLiveQuery(() => loadSuggestions(date, today), [date, today])
  const sources = useLiveQuery(loadFoodSources, [])
  const bls = useBls()
  const blsData = bls.status === 'ready' ? bls.data : null
  const resolver = useFoodResolver(sources, blsData)
  const meals = useMemo(() => new Map((sources?.meals ?? []).map((m) => [m.id, m])), [sources])

  const [view, setView] = useState<View>({ kind: 'list' })
  const [edited, setEdited] = useState<ReadonlyMap<string, ResolvedPart>>(new Map())
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const [input, setInput] = useState<AmountInput>(EMPTY_INPUT)
  const [swipedId, setSwipedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Schließen setzt alles zurück: jedes Öffnen beginnt frisch
  const close = () => {
    setView({ kind: 'list' })
    setEdited(new Map())
    setRemoved(new Set())
    setSwipedId(null)
    onClose()
  }
  // Alles erledigt: schließen (Zustand ist dann ohnehin leer)
  useEffect(() => {
    if (open && groups && groups.length === 0) onClose()
  }, [open, groups, onClose])

  const partWith = (map: ReadonlyMap<string, ResolvedPart>) => (s: Suggestion): ResolvedPart =>
    map.get(s.id) ?? resolvePart(s.payload, resolver.resolve, (id) => meals.get(id))
  const partOf = partWith(edited)
  const remaining = (g: SuggestionGroup) => g.items.filter((s) => !removed.has(s.id))
  const slotName = (id: string) => slots.find((s) => s.id === id)?.name ?? ''

  const run = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
    } catch (error) {
      console.error(error)
      toast('Das hat nicht geklappt')
    } finally {
      setBusy(false)
    }
  }

  /** Übernehmen: verbliebene Teile als Einträge; herausgenommene und nicht gefundene gelten als abgelehnt */
  const accept = (group: SuggestionGroup, chosenSlotId?: string, map: ReadonlyMap<string, ResolvedPart> = edited) => {
    const items = remaining(group)
    const slotId = chosenSlotId ?? slotIdFor(items[0]?.payload.slot ?? null, slots)
    if (slotId === null) return setView({ kind: 'slot', group })
    const part = partWith(map)
    void run(async () => {
      const usable = items.filter((s) => part(s).kind !== 'missing')
      const parts = usable.map((s) => ({ part: part(s), slotId }))
      const rejected = group.items.filter((s) => !usable.includes(s)).map((s) => s.id)
      const entries = suggestionEntries(parts, date, group.name ? { id: group.id, name: group.name } : null)
      const added = await acceptSuggestions(entries, usable.map((s) => s.id), rejected)
      setView({ kind: 'list' })
      if (added.length === 0) return toast('Schon übernommen')
      showNewEntry(slotId, added[0]!.id)
      toast(`${added.length === 1 ? added[0]!.nameSnapshot : `${added.length} Einträge`} zu ${slotName(slotId)}`)
    })
  }

  const reject = (ids: string[], message: string) => {
    setSwipedId(null)
    void run(async () => {
      await rejectSuggestions(ids)
      toast(message)
    })
  }

  /** Teil aus einer Gruppe nehmen; war es der letzte, ist die Gruppe abgelehnt */
  const takeOut = (group: SuggestionGroup, s: Suggestion) => {
    setSwipedId(null)
    if (remaining(group).length <= 1) return reject(group.items.map((i) => i.id), 'Vorschlag abgelehnt')
    setRemoved(new Set([...removed, s.id]))
  }

  const startEdit = (group: SuggestionGroup, s: Suggestion) => {
    const part = partOf(s)
    const food = part.kind === 'food' ? part.food : part.kind === 'estimate' ? estimateFood(part) : null
    if (food === null) {
      toast(part.kind === 'missing' ? 'Lebensmittel nicht gefunden' : 'Menge lässt sich hier nicht ändern')
      if (group.name === null && part.kind !== 'missing') accept(group)
      return
    }
    const amount = part.kind === 'food' ? part.amount : part.kind === 'estimate' ? part.amount : null
    setInput(amount ? inputFromEntry(amount, null) : EMPTY_INPUT)
    setView({ kind: 'edit', item: s, group, food })
  }

  /** Bester Treffer in eigenen Lebensmitteln bzw. BLS für eine Schätzung */
  const matchFor = (part: ResolvedPart): FoodChoice | null => {
    if (part.kind !== 'estimate') return null
    const own = bestMatch(part.name, resolver.productIndex, (f) => f.name)
    if (own) return own
    const food = blsData ? bestMatch(part.name, blsData.index, (f) => f.name) : null
    return food ? (resolver.resolve(`bls:${food.code}`) ?? null) : null
  }

  if (!groups) return null

  if (view.kind === 'edit') {
    const part = partOf(view.item)
    const match = matchFor(part)
    const confirm = () => {
      const amount = inputAmount(input)
      if (amount === null || amount <= 0) return
      const next: ResolvedPart =
        part.kind === 'estimate' ? scaleEstimate(part, amount) : part.kind === 'food' ? { ...part, amount } : part
      const nextEdited = new Map(edited).set(view.item.id, next)
      setEdited(nextEdited)
      setView({ kind: 'list' })
      // Einzelvorschlag: gleich eintragen, mit dem gerade bearbeiteten Teil
      if (view.group.name === null) accept(view.group, undefined, nextEdited)
    }
    return (
      // Zurück nur im Mengen-Schritt selbst (wie beim Hinzufügen), nicht zusätzlich im Kopf
      <Sheet open={open} onClose={close} title="Vorschlag">
        <AmountStep
          food={view.food}
          input={input}
          onInput={setInput}
          onBack={() => setView({ kind: 'list' })}
          confirmLabel={view.group.name === null ? 'Hinzufügen' : 'Fertig'}
          onConfirm={confirm}
          busy={busy}
          secondary={
            match && (
              <Button
                variant="secondary"
                onClick={() => {
                  const amount = part.kind === 'estimate' && part.amount && part.unit === match.unit ? part.amount : (match.portions[0]?.amount ?? 100)
                  setEdited(new Map(edited).set(view.item.id, { kind: 'food', food: match, amount }))
                  setInput(inputFromEntry(amount, null))
                  setView({ ...view, food: match })
                }}
              >
                Stattdessen {match.name} ({match.source}) nehmen
              </Button>
            )
          }
        />
      </Sheet>
    )
  }

  if (view.kind === 'slot') {
    return (
      <Sheet open={open} onClose={close} title="Zu welcher Mahlzeit?" onBack={() => setView({ kind: 'list' })}>
        <div className="scroll-area px-screen-x pb-[calc(24px+env(safe-area-inset-bottom))]">
          <Card padded={false} className="[&>*:first-child]:border-t-0">
            {slots
              .filter((s) => !s.archived && s.deletedAt === null)
              .sort((a, b) => a.order - b.order)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={busy}
                  onClick={() => accept(view.group, s.id)}
                  className="press border-line text-body flex min-h-[52px] w-full items-center gap-2.5 border-t px-3.5 text-left"
                >
                  <span className="flex-1">{s.name}</span>
                  <IconChevronRight className="text-muted shrink-0" />
                </button>
              ))}
          </Card>
        </div>
      </Sheet>
    )
  }

  const row = (group: SuggestionGroup, s: Suggestion) => {
    const part = partOf(s)
    const { title, detail } = describe(s, part)
    const single = group.name === null
    return (
      <SwipeRow
        key={s.id}
        swiped={swipedId === s.id}
        anySwiped={swipedId !== null}
        onSwipe={(isOpen) => setSwipedId(isOpen ? s.id : null)}
        onTap={() => startEdit(group, s)}
        onAction={() => (single ? reject([s.id], 'Vorschlag abgelehnt') : takeOut(group, s))}
        actionLabel={single ? 'Ablehnen' : 'Entfernen'}
        label={`${title}, ${detail}`}
      >
        <div className={`flex min-h-14 items-center gap-2.5 py-2 pr-3.5 ${single ? 'pl-3.5' : 'pl-6'}`}>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-body font-medium break-words">{title}</span>
            <span className={`text-small ${part.kind === 'missing' ? 'text-warn-text' : 'text-muted'}`}>{detail}</span>
          </span>
          <IconChevronRight className="text-muted shrink-0" />
        </div>
      </SwipeRow>
    )
  }

  return (
    <Sheet open={open} onClose={close} title="Vorschläge aus Fitboard">
      <div className="scroll-area px-screen-x gap-card-gap flex flex-col pb-[calc(24px+env(safe-area-inset-bottom))]">
        {groups.map((group) => {
          const items = remaining(group)
          const usable = items.some((s) => partOf(s).kind !== 'missing')
          if (group.name === null) {
            return (
              <Card key={group.id} padded={false}>
                {items.map((s) => row(group, s))}
              </Card>
            )
          }
          return (
            <Card key={group.id} padded={false} className="[&>*:first-child]:border-t-0">
              <SwipeRow
                swiped={swipedId === group.id}
                anySwiped={swipedId !== null}
                onSwipe={(isOpen) => setSwipedId(isOpen ? group.id : null)}
                onTap={() => setSwipedId(null)}
                onAction={() => reject(group.items.map((s) => s.id), `${group.name} abgelehnt`)}
                actionLabel="Ablehnen"
                label={`${group.name}, ${items.length} Teile`}
              >
                <div className="flex min-h-14 items-center gap-2.5 px-3.5 py-2">
                  <span className="text-body flex-1 font-semibold break-words">{group.name}</span>
                  <Button variant="small" disabled={busy || !usable} onClick={() => accept(group)}>
                    Alle übernehmen
                  </Button>
                </div>
              </SwipeRow>
              {items.map((s) => row(group, s))}
            </Card>
          )
        })}
        <p className="text-small text-muted px-1 leading-[1.45]">
          Tippen ändert die Menge. Nach links wischen nimmt einen Teil heraus oder lehnt ab.
        </p>
      </div>
    </Sheet>
  )
}

/** Zeilentext: Name; Menge · kcal · Herkunft */
function describe(s: Suggestion, part: ResolvedPart): { title: string; detail: string } {
  switch (part.kind) {
    case 'food':
      return {
        title: part.food.name,
        detail: `${formatAmount(part.amount)} ${part.food.unit} · ${formatNumber(part.food.per100.kcal === null ? null : (part.food.per100.kcal * part.amount) / 100)} kcal`,
      }
    case 'meal':
      return { title: part.meal.name, detail: `Mahlzeit${part.scale !== 1 ? ` × ${formatNumber(part.scale, 1)}` : ''}` }
    case 'estimate': {
      const amount = part.amount !== null && part.unit !== null ? `${formatAmount(part.amount)} ${part.unit} · ` : ''
      return { title: part.name, detail: `${amount}~${formatNumber(part.nutrients.kcal)} kcal · geschätzt` }
    }
    case 'missing':
      return { title: s.payload.name, detail: 'Lebensmittel nicht gefunden' }
  }
}
