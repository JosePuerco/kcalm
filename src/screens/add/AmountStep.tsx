// Mengen-Schritt nach Kern.dc.html: Zurück, Produktname + Quelle + kcal/100 · große Menge mit Einheit und kcal ·
// 4 Makro-Kacheln · Portions-Chips · eigener Ziffernblock · Hauptknopf.
// Tipp auf einen Portions-Chip schaltet den Ziffernblock auf Anzahl („4 × Reiswaffel“), Chip „g“ zurück (Phase 12b).
import type { ReactNode } from 'react'
import { IconBack, IconCheck } from '../../components/icons/icons.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Chip } from '../../components/ui/Chip.tsx'
import { Keypad } from '../../components/ui/Keypad.tsx'
import { per100Label, portionChipLabel, type FoodChoice } from '../../logic/addFood.ts'
import { formatAmount, formatNumber } from '../../logic/format.ts'
import { nutrientsForAmount } from '../../logic/nutrients.ts'
import {
  inputAmount,
  isActivePortion,
  keypadText,
  portionName,
  selectGrams,
  selectPortion,
  withText,
  type AmountInput,
} from '../../logic/portionCount.ts'

type Props = {
  food: FoodChoice
  input: AmountInput
  onInput: (input: AmountInput) => void
  onBack: () => void
  confirmLabel: string
  onConfirm: () => void
  busy?: boolean
  /** z. B. „Löschen“ beim Bearbeiten (3d) */
  secondary?: ReactNode
}

export function AmountStep({ food, input, onInput, onBack, confirmLabel, onConfirm, busy, secondary }: Props) {
  const value = inputAmount(input) ?? 0
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
          <span className="text-small text-muted flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {food.source} · {per100Label(food)}
            {/* Geprüft-Markierung (DESIGN.md), z. B. direkt nach dem Scan sichtbar (Wunsch von Jan) */}
            {food.verified && (
              <span className="bg-accent-soft text-accent-text rounded-small-button inline-flex items-center gap-1 px-1.5 font-medium">
                <IconCheck size={12} strokeWidth={2.6} />
                geprüft
              </span>
            )}
          </span>
        </span>
      </div>

      <div className="px-1 pt-3.5 pb-1.5" aria-live="polite">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-hero flex min-w-0 items-baseline">
            {input.text || '0'}
            {/* Abstand per Rand statt Leerzeichen: am Anfang eines Flex-Kinds fiele es weg */}
            <span className="text-unit text-muted ml-1 truncate tracking-normal">
              {input.portion ? `× ${portionName(input.portion)}` : food.unit}
            </span>
          </span>
          <span className="text-unit shrink-0 font-semibold">
            {formatNumber(n.kcal)} <span className="text-label text-muted font-normal">kcal</span>
          </span>
        </div>
        {input.portion && (
          <span className="text-small text-muted block">
            = {formatAmount(value)} {food.unit}
          </span>
        )}
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
          <Chip variant="portion" active={!input.portion} aria-pressed={!input.portion} onClick={() => onInput(selectGrams(input))}>
            {food.unit}
          </Chip>
          {food.portions.map((p) => {
            const active = isActivePortion(input, p)
            return (
              <Chip
                key={`${p.label}-${p.amount}`}
                variant="portion"
                active={active}
                aria-pressed={active}
                onClick={() => onInput(selectPortion(p))}
              >
                {portionChipLabel(p, food.unit)}
              </Chip>
            )
          })}
        </div>
      )}

      <div className="mt-auto">
        <Keypad value={keypadText(input)} onChange={(text) => onInput(withText(input, text))} />
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
