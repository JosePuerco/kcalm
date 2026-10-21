// Mengen-Schritt nach Kern.dc.html: Zurück, Produktname + Quelle + kcal/100 · große Menge mit Einheit und kcal ·
// 4 Makro-Kacheln · Portions-Chips · eigener Ziffernblock · Hauptknopf.
import type { ReactNode } from 'react'
import { IconBack } from '../../components/icons/icons.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Chip } from '../../components/ui/Chip.tsx'
import { Keypad } from '../../components/ui/Keypad.tsx'
import { amountToKeypad, per100Label, portionChipLabel, type FoodChoice } from '../../logic/addFood.ts'
import { formatNumber } from '../../logic/format.ts'
import { parseKeypadValue } from '../../logic/keypad.ts'
import { nutrientsForAmount } from '../../logic/nutrients.ts'

type Props = {
  food: FoodChoice
  amount: string
  onAmount: (amount: string) => void
  onBack: () => void
  confirmLabel: string
  onConfirm: () => void
  busy?: boolean
  /** z. B. „Löschen“ beim Bearbeiten (3d) */
  secondary?: ReactNode
}

export function AmountStep({ food, amount, onAmount, onBack, confirmLabel, onConfirm, busy, secondary }: Props) {
  const value = parseKeypadValue(amount) ?? 0
  const n = nutrientsForAmount(food.per100, value)
  const grams = (v: number | null) => (v === null ? '–' : `${formatNumber(v, 1)} g`)
  const tiles = [
    { label: 'Eiweiß', value: grams(n.protein) },
    { label: 'Kohlenh.', value: grams(n.carbs) },
    { label: 'Fett', value: grams(n.fat) },
    { label: 'Ballastst.', value: grams(n.fiber) },
  ]

  return (
    <div className="px-screen-x flex min-h-0 flex-1 flex-col pb-[calc(16px+env(safe-area-inset-bottom))]">
      <div className="-ml-2.5 flex items-center gap-1">
        <button type="button" aria-label="Zurück" onClick={onBack} className="press flex size-11 shrink-0 items-center justify-center">
          <IconBack />
        </button>
        <span className="flex min-w-0 flex-col">
          <span className="text-sheet-title truncate">{food.name}</span>
          <span className="text-small text-muted">
            {food.source} · {per100Label(food)}
          </span>
        </span>
      </div>

      <div className="flex items-baseline justify-between px-1 pt-3.5 pb-1.5" aria-live="polite">
        <span className="text-hero">
          {amount || '0'}
          <span className="text-unit text-muted"> {food.unit}</span>
        </span>
        <span className="text-unit font-semibold">
          {formatNumber(n.kcal)} <span className="text-label text-muted font-normal">kcal</span>
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 pt-1.5 pb-3">
        {tiles.map((t) => (
          <div key={t.label} className="bg-card rounded-tile flex flex-col gap-0.5 px-2.5 py-2">
            <span className="text-tiny text-muted">{t.label}</span>
            <span className="text-label font-semibold">{t.value}</span>
          </div>
        ))}
      </div>

      {food.portions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-2.5">
          {food.portions.map((p) => (
            <Chip key={`${p.label}-${p.amount}`} variant="portion" onClick={() => onAmount(amountToKeypad(p.amount))}>
              {portionChipLabel(p, food.unit)}
            </Chip>
          ))}
        </div>
      )}

      <div className="mt-auto">
        <Keypad value={amount} onChange={onAmount} />
      </div>
      <div className="mt-2.5 flex gap-2">
        {secondary}
        <Button className="flex-1" disabled={value <= 0 || busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}
