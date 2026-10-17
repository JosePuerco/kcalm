// Karte „Portionen“ nach Produkt.dc.html mit Sheet zum Anlegen, Ändern und Löschen.
import { useState } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { Sheet } from '../../components/ui/Sheet.tsx'
import { TextField } from '../../components/ui/TextField.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import type { Portion, Unit } from '../../db/types.ts'
import { formatAmount } from '../../logic/format.ts'
import { toInput, validatePortion } from '../../logic/productForm.ts'

type Props = {
  portions: readonly Portion[]
  unit: Unit
  onSave: (portions: Portion[]) => Promise<void>
}

/** null = Sheet zu, 'new' = neue Portion, Zahl = Index der bearbeiteten Portion */
type Editing = null | 'new' | number

export function PortionsCard({ portions, unit, onSave }: Props) {
  const [editing, setEditing] = useState<Editing>(null)
  const close = () => setEditing(null)

  return (
    <Card padded={false} className="px-card-padding py-1">
      <div className="flex min-h-12 items-center justify-between">
        <h2 className="text-body font-semibold">Portionen</h2>
        <Button variant="text" className="text-label -mr-2.5" onClick={() => setEditing('new')}>
          Hinzufügen
        </Button>
      </div>
      {portions.length === 0 && (
        <p className="border-line text-label text-muted flex min-h-touch-min items-center border-t">
          Noch keine Portionen
        </p>
      )}
      {portions.map((p, i) => (
        <button
          key={p.label}
          type="button"
          onClick={() => setEditing(i)}
          className="border-line text-label flex min-h-touch-min w-full items-center justify-between border-t"
        >
          <span className="min-w-0 truncate">{p.label}</span>
          <span className="text-muted pl-3 whitespace-nowrap">
            {formatAmount(p.amount)} {unit}
          </span>
        </button>
      ))}
      <Sheet open={editing !== null} onClose={close} title={editing === 'new' ? 'Neue Portion' : 'Portion'} doneLabel="Abbrechen">
        {editing !== null && (
          <PortionEditor
            key={String(editing)}
            unit={unit}
            initial={editing === 'new' ? undefined : portions[editing]}
            otherLabels={portions.filter((_, i) => i !== editing).map((p) => p.label)}
            onSave={async (portion) => {
              const next = [...portions]
              if (editing === 'new') next.push(portion)
              else next[editing] = portion
              await onSave(next)
              close()
            }}
            onDelete={
              editing === 'new'
                ? undefined
                : async () => {
                    await onSave(portions.filter((_, i) => i !== editing))
                    close()
                  }
            }
          />
        )}
      </Sheet>
    </Card>
  )
}

type EditorProps = {
  unit: Unit
  initial?: Portion
  otherLabels: string[]
  onSave: (portion: Portion) => Promise<void>
  onDelete?: () => Promise<void>
}

function PortionEditor({ unit, initial, otherLabels, onSave, onDelete }: EditorProps) {
  const toast = useToast()
  const [label, setLabel] = useState(initial?.label ?? '')
  const [amount, setAmount] = useState(initial ? toInput(initial.amount) : '')
  const [errors, setErrors] = useState<{ label?: string; amount?: string }>({})

  const save = async () => {
    const result = validatePortion({ label, amount }, otherLabels)
    if (!result.ok) return setErrors(result.errors)
    try {
      await onSave(result.portion)
    } catch (error) {
      console.error(error)
      toast('Speichern fehlgeschlagen')
    }
  }

  return (
    <form
      noValidate
      className="scroll-area px-screen-x flex flex-col gap-3 pb-[calc(16px+env(safe-area-inset-bottom))]"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <div className="bg-card rounded-card px-card-padding">
        <TextField
          label="Bezeichnung"
          placeholder="z. B. 1 Becher"
          value={label}
          error={errors.label}
          onChange={(e) => setLabel(e.target.value)}
          enterKeyHint="next"
          autoComplete="off"
        />
        <div className="border-line border-t">
          <TextField
            label={`Menge in ${unit}`}
            placeholder="z. B. 150"
            inputMode="decimal"
            value={amount}
            error={errors.amount}
            onChange={(e) => setAmount(e.target.value)}
            enterKeyHint="done"
            autoComplete="off"
          />
        </div>
      </div>
      <Button type="submit" className="w-full">
        Sichern
      </Button>
      {onDelete && (
        <Button variant="danger" className="w-full" onClick={() => void onDelete()}>
          Portion löschen
        </Button>
      )}
    </form>
  )
}
