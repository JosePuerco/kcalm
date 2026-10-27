// Lebensmittel für ein Rezept (und in 5d eine Mahlzeit) auswählen: Such-Schritt → Mengen-Schritt wie im
// Hinzufügen-Sheet (Kern.dc.html), ohne Schnelleintrag und Scan. Beim Ändern einer Zeile direkt der Mengen-Schritt
// mit „Entfernen“. Kein eigener Prototyp (mit Jan abgestimmt).
import { motion } from 'motion/react'
import { useState } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { Sheet } from '../../components/ui/Sheet.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import type { BlsData } from '../../data/bls.ts'
import type { FoodSources } from '../../db/entries.ts'
import { saveOffProduct } from '../../db/off.ts'
import { amountToKeypad, choiceFromProduct, type FoodChoice } from '../../logic/addFood.ts'
import { parseKeypadValue } from '../../logic/keypad.ts'
import type { OffProduct } from '../../logic/off.ts'
import { instant, motionTokens, useReduced } from '../../motion/motion.ts'
import { AmountStep } from '../add/AmountStep.tsx'
import { SearchStep } from '../add/SearchStep.tsx'
import type { FoodResolver } from '../add/useFoodResolver.ts'

/** Zeile, die geändert wird */
export interface PickerEdit {
  food: FoodChoice
  amount: number
}

type Props = {
  open: boolean
  onClose: () => void
  title: string
  /** null = neues Lebensmittel suchen */
  editing: PickerEdit | null
  sources: FoodSources | undefined
  bls: BlsData | null
  resolver: FoodResolver
  exclude?: (food: FoodChoice) => boolean
  confirmLabel: string
  onConfirm: (food: FoodChoice, amount: number) => void
  onRemove?: () => void
}

export function FoodPickerSheet({ open, onClose, title, editing, ...rest }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={title} doneLabel="Abbrechen">
      {/* Jedes Öffnen beginnt frisch */}
      {open && <PickerFlow key={editing?.food.ref ?? 'neu'} editing={editing} onClose={onClose} {...rest} />}
    </Sheet>
  )
}

type FlowProps = Omit<Props, 'open' | 'title'>

function PickerFlow({
  editing,
  onClose,
  sources,
  bls,
  resolver,
  exclude,
  confirmLabel,
  onConfirm,
  onRemove,
}: FlowProps) {
  const toast = useToast()
  const reduced = useReduced()
  const [food, setFood] = useState<FoodChoice | null>(editing?.food ?? null)
  const [amount, setAmount] = useState(editing ? amountToKeypad(editing.amount) : '')
  const [query, setQuery] = useState('')

  const pick = (choice: FoodChoice) => {
    setAmount('')
    setFood(choice)
  }

  // OFF-Treffer lokal speichern; ohne kcal lässt er sich nicht verwenden (dafür gibt es das Produktformular)
  const pickOff = async (product: OffProduct) => {
    if (product.per100.kcal === null) {
      toast('Ohne kcal-Angabe. Lege es unter Lebensmittel als eigenes Produkt an.')
      return
    }
    try {
      pick(choiceFromProduct(await saveOffProduct(product)))
    } catch (error) {
      console.error(error)
      toast('Speichern fehlgeschlagen')
    }
  }

  const confirm = (choice: FoodChoice) => {
    const value = parseKeypadValue(amount)
    if (value === null || value <= 0) return
    onConfirm(choice, value)
    onClose()
  }

  return (
    <motion.div
      key={food?.ref ?? 'search'}
      className="flex min-h-0 flex-1 flex-col"
      initial={reduced ? false : { opacity: 0, x: motionTokens.sheetStepOffsetX }}
      animate={{ opacity: 1, x: 0 }}
      transition={reduced ? instant : motionTokens.sheetStep}
    >
      {food ? (
        <AmountStep
          food={food}
          amount={amount}
          onAmount={setAmount}
          // Beim Ändern schließt Zurück (wie beim Bearbeiten im Tagebuch), sonst zurück zur Suche
          onBack={editing ? onClose : () => setFood(null)}
          confirmLabel={confirmLabel}
          onConfirm={() => confirm(food)}
          secondary={
            editing &&
            onRemove && (
              <Button
                variant="danger"
                onClick={() => {
                  onRemove()
                  onClose()
                }}
              >
                Entfernen
              </Button>
            )
          }
        />
      ) : (
        sources && (
          <SearchStep
            query={query}
            onQuery={setQuery}
            sources={sources}
            bls={bls}
            resolver={resolver}
            onPick={pick}
            onPickOff={(product) => void pickOff(product)}
            exclude={exclude}
          />
        )
      )}
    </motion.div>
  )
}
