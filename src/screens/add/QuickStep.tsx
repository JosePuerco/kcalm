// Schnelleintrag nach Schnell.dc.html: Name optional, große kcal-Zahl, 3 Makro-Felder; aktives Feld blau
// umrandet, Eingabe über den Ziffernblock. Darunter „Makros ergeben 832 kcal · passt“ (bei > 10 % Abweichung
// in warnText) und „Weitere Nährwerte“. Bei aktiver Kostenauswertung zusätzlich „Preis“ (Phase 13, kein Prototyp).
import { useState, type ReactNode } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { Keypad } from '../../components/ui/Keypad.tsx'
import {
  MAIN_MACROS,
  MORE_FIELDS,
  QUICK_LABEL,
  macroCheck,
  macroCheckText,
  type QuickField,
  type QuickValues,
} from '../../logic/quickEntry.ts'

type Props = {
  values: QuickValues
  onChange: (values: QuickValues) => void
  error: string | null
  confirmLabel: string
  onConfirm: () => void
  busy?: boolean
  /** „Löschen“ beim Bearbeiten */
  secondary?: ReactNode
  /** Preisfeld zeigen (Kostenauswertung an) */
  showCost?: boolean
}

type Active = QuickField | 'cost'

const ring = (active: boolean) => (active ? 'ring-accent ring-2' : '')

export function QuickStep({ values, onChange, error, confirmLabel, onConfirm, busy, secondary, showCost }: Props) {
  const [active, setActive] = useState<Active>('kcal')
  const [showMore, setShowMore] = useState(() => MORE_FIELDS.some((k) => values.fields[k] !== ''))
  const check = macroCheck(values)
  const setField = (value: string) =>
    onChange(active === 'cost' ? { ...values, cost: value } : { ...values, fields: { ...values.fields, [active]: value } })
  const shown = (key: QuickField) => values.fields[key] || '–'

  const small = (key: QuickField) => (
    <button
      key={key}
      type="button"
      onClick={() => setActive(key)}
      aria-pressed={active === key}
      className={`press bg-card rounded-field flex flex-col gap-0.5 px-3 py-2.5 text-left ${ring(active === key)}`}
    >
      <span className="text-small text-muted">{QUICK_LABEL[key]}</span>
      <span className="text-sheet-title">
        {shown(key)}
        <span className="text-secondary text-muted font-normal"> g</span>
      </span>
    </button>
  )

  return (
    <div className="px-screen-x flex min-h-0 flex-1 flex-col pb-[calc(16px+env(safe-area-inset-bottom))]">
      <div className="scroll-area -mx-1 flex flex-col gap-2 px-1 pt-0.5">
        <label className="bg-card rounded-field flex min-h-12 items-center gap-2 px-3.5">
          <span className="sr-only">Name</span>
          <input
            value={values.name}
            onChange={(e) => onChange({ ...values, name: e.target.value })}
            placeholder="Name (optional), z. B. Döner"
            autoComplete="off"
            enterKeyHint="done"
            className="text-body-large text-text placeholder:text-muted min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => setActive('kcal')}
          aria-pressed={active === 'kcal'}
          className={`press bg-card rounded-card flex items-baseline justify-between px-4 py-3 ${ring(active === 'kcal')}`}
        >
          <span className="text-secondary text-muted">{QUICK_LABEL.kcal}</span>
          <span className="text-hero">
            {shown('kcal')}
            <span className="text-body-large text-muted font-medium"> kcal</span>
          </span>
        </button>
        <div className="grid grid-cols-3 gap-2">{MAIN_MACROS.map(small)}</div>
        {showMore && <div className="grid grid-cols-2 gap-2">{MORE_FIELDS.map(small)}</div>}
        {showCost && (
          <button
            type="button"
            onClick={() => setActive('cost')}
            aria-pressed={active === 'cost'}
            className={`press bg-card rounded-field flex min-h-12 items-center justify-between px-3.5 ${ring(active === 'cost')}`}
          >
            <span className="text-secondary text-muted">Preis (optional)</span>
            <span className="text-sheet-title">
              {values.cost || '–'}
              <span className="text-secondary text-muted font-normal"> €</span>
            </span>
          </button>
        )}
        <div className="flex min-h-touch-min items-center justify-between gap-2 px-1">
          <span className={`text-small ${check && !check.ok ? 'text-warn-text' : 'text-muted'}`}>
            {check ? macroCheckText(check) : 'Leere Felder zählen als unbekannt'}
          </span>
          {!showMore && (
            <button
              type="button"
              onClick={() => setShowMore(true)}
              className="text-secondary text-accent-text min-h-touch-min font-medium whitespace-nowrap"
            >
              Weitere Nährwerte
            </button>
          )}
        </div>
      </div>

      <div className="pt-2">
        <Keypad value={active === 'cost' ? values.cost : values.fields[active]} onChange={setField} />
      </div>
      {error && <p className="text-small text-danger px-1 pt-2">{error}</p>}
      <div className="mt-2.5 flex gap-2">
        {secondary}
        <Button className="flex-1" disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}
