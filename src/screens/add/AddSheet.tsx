// Hinzufügen-Sheet nach Kern.dc.html: Slot-Chips oben, dann Such-Schritt → Mengen-Schritt.
// Nach dem Hinzufügen bleibt das Sheet offen (Toast als Bestätigung), „Fertig“ schließt.
import { motion } from 'motion/react'
import { useState } from 'react'
import { closeAddSheet, showNewEntry, useAddSheet, useDiaryState, useToday } from '../../app/diaryState.ts'
import { Chip } from '../../components/ui/Chip.tsx'
import { Sheet } from '../../components/ui/Sheet.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { useBls } from '../../data/bls.ts'
import { addEntry, loadFoodSources } from '../../db/entries.ts'
import { useLiveQuery } from '../../db/live.ts'
import { getSlots } from '../../db/slots.ts'
import type { Slot } from '../../db/types.ts'
import { addedMessage, amountToKeypad, foodEntry, initialAmount, type FoodChoice } from '../../logic/addFood.ts'
import { formatTime } from '../../logic/format.ts'
import { parseKeypadValue } from '../../logic/keypad.ts'
import { slotForTime } from '../../logic/slots.ts'
import { instant, motionTokens, useReduced } from '../../motion/motion.ts'
import { AmountStep } from './AmountStep.tsx'
import { SearchStep } from './SearchStep.tsx'

export function AddSheet() {
  const sheet = useAddSheet()
  const slots = useLiveQuery(getSlots, [])
  return (
    <Sheet open={sheet.open} onClose={closeAddSheet} title="Hinzufügen">
      {/* Inhalt erst mit Slots: dann stimmt die Vorauswahl; jedes Öffnen beginnt frisch */}
      {slots && <AddFlow slots={slots} initialSlotId={sheet.slotId} />}
    </Sheet>
  )
}

type Step = { kind: 'search' } | { kind: 'amount'; food: FoodChoice }

function AddFlow({ slots, initialSlotId }: { slots: Slot[]; initialSlotId: string | null }) {
  const toast = useToast()
  const reduced = useReduced()
  const today = useToday()
  const date = useDiaryState().date ?? today
  const sources = useLiveQuery(loadFoodSources, [])
  const bls = useBls()
  const [slotId, setSlotId] = useState(
    () => (initialSlotId && slots.some((s) => s.id === initialSlotId) ? initialSlotId : slotForTime(slots, formatTime(new Date()))?.id) ?? null,
  )
  const [step, setStep] = useState<Step>({ kind: 'search' })
  const [query, setQuery] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const slot = slots.find((s) => s.id === slotId) ?? slots[0]

  const pick = (food: FoodChoice) => {
    setAmount(amountToKeypad(initialAmount(food)))
    setStep({ kind: 'amount', food })
  }

  const confirm = async (food: FoodChoice) => {
    const value = parseKeypadValue(amount)
    if (!slot || value === null || value <= 0) return
    setBusy(true)
    try {
      const entry = await addEntry(foodEntry(food, value, date, slot.id))
      showNewEntry(slot.id, entry.id)
      toast(addedMessage(food.name, entry.nutrients.kcal, slot.name))
      // Im Sheet bleiben: zurück zur Suche für das nächste Lebensmittel
      setQuery('')
      setStep({ kind: 'search' })
    } catch (error) {
      console.error(error)
      toast('Speichern fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex gap-1.5 overflow-x-auto px-4 pt-1 pb-2.5 [scrollbar-width:none]">
        {slots.map((s) => (
          <Chip key={s.id} active={s.id === slot?.id} onClick={() => setSlotId(s.id)}>
            {s.name}
          </Chip>
        ))}
      </div>
      <motion.div
        key={step.kind === 'amount' ? step.food.ref : 'search'}
        className="flex min-h-0 flex-1 flex-col"
        initial={reduced ? false : { opacity: 0, x: motionTokens.sheetStepOffsetX }}
        animate={{ opacity: 1, x: 0 }}
        transition={reduced ? instant : motionTokens.sheetStep}
      >
        {step.kind === 'search' ? (
          sources && (
            <SearchStep
              query={query}
              onQuery={setQuery}
              sources={sources}
              bls={bls.status === 'ready' ? bls.data : null}
              onPick={pick}
            />
          )
        ) : (
          <AmountStep
            food={step.food}
            amount={amount}
            onAmount={setAmount}
            onBack={() => setStep({ kind: 'search' })}
            confirmLabel={`Zu ${slot?.name ?? ''} hinzufügen`}
            onConfirm={() => void confirm(step.food)}
            busy={busy}
          />
        )}
      </motion.div>
    </>
  )
}
