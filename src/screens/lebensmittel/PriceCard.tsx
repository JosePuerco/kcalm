// Karte „Preis“ für eigene, OFF- und BLS-Lebensmittel (Phase 13, kein Prototyp), aufgebaut wie die
// Portionen-Karte: Zeile antippen öffnet ein Sheet mit Preis und Packungsgröße. Nur bei aktiver Kostenauswertung.
import { useState } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { Sheet } from '../../components/ui/Sheet.tsx'
import { TextField } from '../../components/ui/TextField.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import type { Price, Unit } from '../../db/types.ts'
import { basePriceText, formatEuro, validatePrice } from '../../logic/cost.ts'
import { formatAmount } from '../../logic/format.ts'
import { toInput } from '../../logic/productForm.ts'

type Props = {
  price: Price | null
  unit: Unit
  onSave: (price: Price | null) => Promise<void>
}

export function PriceCard({ price, unit, onSave }: Props) {
  const [open, setOpen] = useState(false)
  const base = basePriceText(price, unit)

  return (
    <Card padded={false} className="px-card-padding py-1">
      <div className="flex min-h-12 items-center justify-between">
        <h2 className="text-body font-semibold">Preis</h2>
        <Button variant="text" className="text-label -mr-2.5" onClick={() => setOpen(true)}>
          {price ? 'Ändern' : 'Eintragen'}
        </Button>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-line text-label flex min-h-touch-min w-full items-center justify-between border-t"
      >
        {price ? (
          <>
            <span>
              {formatEuro(price.amount)} für {formatAmount(price.per)} {unit}
            </span>
            {base && <span className="text-muted pl-3 whitespace-nowrap">{base}</span>}
          </>
        ) : (
          <span className="text-muted">Noch kein Preis</span>
        )}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Preis" doneLabel="Abbrechen">
        {open && (
          <PriceEditor
            unit={unit}
            initial={price}
            onSave={async (next) => {
              await onSave(next)
              setOpen(false)
            }}
          />
        )}
      </Sheet>
    </Card>
  )
}

type EditorProps = {
  unit: Unit
  initial: Price | null
  onSave: (price: Price | null) => Promise<void>
}

function PriceEditor({ unit, initial, onSave }: EditorProps) {
  const toast = useToast()
  const [amount, setAmount] = useState(initial ? toInput(initial.amount) : '')
  const [per, setPer] = useState(initial ? toInput(initial.per) : '')
  const [errors, setErrors] = useState<{ amount?: string; per?: string }>({})

  const save = async (price: Price | null) => {
    try {
      await onSave(price)
    } catch (error) {
      console.error(error)
      toast('Speichern fehlgeschlagen')
    }
  }
  const submit = () => {
    const result = validatePrice({ amount, per })
    if (!result.ok) return setErrors(result.errors)
    void save(result.price)
  }

  return (
    <form
      noValidate
      className="scroll-area px-screen-x flex flex-col gap-3 pb-[calc(16px+env(safe-area-inset-bottom))]"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="bg-card rounded-card px-card-padding">
        <TextField
          label="Preis in €"
          placeholder="z. B. 1,49"
          inputMode="decimal"
          value={amount}
          error={errors.amount}
          onChange={(e) => setAmount(e.target.value)}
          enterKeyHint="next"
          autoComplete="off"
        />
        <div className="border-line border-t">
          <TextField
            label={`Packungsgröße in ${unit}`}
            placeholder="z. B. 500"
            inputMode="decimal"
            value={per}
            error={errors.per}
            onChange={(e) => setPer(e.target.value)}
            enterKeyHint="done"
            autoComplete="off"
          />
        </div>
      </div>
      <p className="text-small text-muted px-1">
        Gilt für alle Einträge, auch für frühere Tage. Ein neuer Preis ändert die Kosten rückwirkend.
      </p>
      <Button type="submit" className="w-full">
        Sichern
      </Button>
      {initial && (
        <Button variant="danger" className="w-full" onClick={() => void save(null)}>
          Preis entfernen
        </Button>
      )}
    </form>
  )
}
