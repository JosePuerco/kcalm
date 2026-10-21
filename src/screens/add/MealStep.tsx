// Mahlzeit eintragen nach Mahlzeit.dc.html: Summe kcal + „3 von 4 Bestandteilen“, 4 Makro-Kacheln, Skalierung
// ×0,5 / ×1 / ×1,5 / ×2, Liste mit Haken, Name, kcal, −/Menge/+; abgewählte Zeilen 40 % Deckkraft.
// Tipp auf eine Menge: Zeile blau umrandet, unten der Ziffernblock statt des Knopfs (mit Jan abgestimmt).
// Name und Zurück stehen im Sheet-Kopf; „Vorlage bearbeiten“ unter der Liste statt oben rechts.
// −/+ 44 statt 40 px (Touch-Ziel, CLAUDE.md).
import { useState } from 'react'
import { IconCheck, IconMinus, IconPlus } from '../../components/icons/icons.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Chip } from '../../components/ui/Chip.tsx'
import { Keypad } from '../../components/ui/Keypad.tsx'
import type { FoodRef, Meal } from '../../db/types.ts'
import type { FoodChoice } from '../../logic/addFood.ts'
import { formatSum } from '../../logic/diary.ts'
import { formatAmount, formatNumber } from '../../logic/format.ts'
import { parseKeypadValue } from '../../logic/keypad.ts'
import {
  amountFromKeypad,
  initialMealLines,
  lineNutrients,
  MEAL_SCALES,
  mealAddLabel,
  mealTotals,
  scaledAmount,
  stepLineAmount,
  type MealLine,
  type MealScale,
} from '../../logic/meal.ts'

type Props = {
  meal: Meal
  resolve: (ref: FoodRef) => FoodChoice | undefined
  slotName: string
  busy: boolean
  onAdd: (lines: MealLine[], scale: number) => void
  onEditTemplate: () => void
}

export function MealStep({ meal, resolve, slotName, busy, onAdd, onEditTemplate }: Props) {
  const [lines, setLines] = useState(() => initialMealLines(meal, resolve))
  const [scale, setScale] = useState<MealScale>(1)
  // Zeile, deren Menge gerade über den Ziffernblock eingegeben wird
  const [typing, setTyping] = useState<number | null>(null)
  const [text, setText] = useState('')

  const totals = mealTotals(lines, scale)
  const sums = totals.nutrients
  const tiles = [
    { label: 'Eiweiß', value: sums.protein },
    { label: 'Kohlenh.', value: sums.carbs },
    { label: 'Fett', value: sums.fat },
    { label: 'Ballastst.', value: sums.fiber },
  ]

  const update = (index: number, changes: Partial<MealLine>) =>
    setLines((ls) => ls.map((l, i) => (i === index ? { ...l, ...changes } : l)))

  const typed = parseKeypadValue(text)
  const confirmTyping = () => {
    if (typing === null || typed === null || typed <= 0) return
    update(typing, { amount: amountFromKeypad(typed, scale) })
    setTyping(null)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-[calc(16px+env(safe-area-inset-bottom))]">
      <div className="flex items-baseline justify-between px-4 pt-1.5 pb-1" aria-live="polite">
        <span className="text-hero">
          {formatSum(sums.kcal)}
          <span className="text-body-large text-muted font-medium"> kcal</span>
        </span>
        <span className="text-secondary text-muted">
          {totals.active} von {totals.all} Bestandteilen
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 px-4 pb-2.5">
        {tiles.map((t) => (
          <div key={t.label} className="bg-card rounded-tile flex flex-col gap-0.5 px-2.5 py-2">
            <span className="text-tiny text-muted">{t.label}</span>
            <span className="text-label font-semibold">{formatSum(t.value, 1)} g</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 px-4 pb-2.5" role="group" aria-label="Menge skalieren">
        <span className="text-secondary text-muted mr-1">Menge</span>
        {MEAL_SCALES.map((s) => (
          <Chip key={s} variant="scale" active={scale === s} onClick={() => setScale(s)}>
            ×{formatAmount(s)}
          </Chip>
        ))}
      </div>

      <div className="scroll-area px-screen-x">
        <div className="bg-card rounded-card overflow-hidden">
          {lines.map((line, i) => (
            <Row
              key={`${line.ref}-${i}`}
              line={line}
              scale={scale}
              first={i === 0}
              typing={typing === i ? text : null}
              onToggle={() => update(i, { on: !line.on })}
              onStep={(direction) => update(i, { amount: stepLineAmount(line, scale, direction) })}
              onType={() => {
                setText('')
                setTyping(typing === i ? null : i)
              }}
            />
          ))}
        </div>
        <p className="text-small text-muted px-1 pt-2.5 leading-[1.4]">
          Tipp auf eine Menge öffnet den Ziffernblock. Änderungen gelten nur für diesen Eintrag, die Vorlage bleibt
          gleich.
        </p>
        <Button variant="text" className="text-label -ml-2.5" onClick={onEditTemplate}>
          Vorlage bearbeiten
        </Button>
      </div>

      <div className="px-screen-x pt-2.5">
        {typing !== null ? (
          <>
            <Keypad value={text} onChange={setText} />
            <div className="mt-2.5 flex gap-2">
              <Button variant="secondary" onClick={() => setTyping(null)}>
                Abbrechen
              </Button>
              <Button className="flex-1" disabled={typed === null || typed <= 0} onClick={confirmTyping}>
                Übernehmen
              </Button>
            </div>
          </>
        ) : (
          <Button className="w-full" disabled={totals.active === 0 || busy} onClick={() => onAdd(lines, scale)}>
            {mealAddLabel(totals.active, slotName)}
          </Button>
        )}
      </div>
    </div>
  )
}

type RowProps = {
  line: MealLine
  scale: number
  first: boolean
  /** Text aus dem Ziffernblock, solange diese Zeile eingegeben wird */
  typing: string | null
  onToggle: () => void
  onStep: (direction: 1 | -1) => void
  onType: () => void
}

function Row({ line, scale, first, typing, onToggle, onStep, onType }: RowProps) {
  const { food, on } = line
  const name = food?.name ?? 'Nicht mehr vorhanden'
  const unit = food?.unit ?? 'g'
  const fade = `transition-opacity duration-200 motion-reduce:transition-none ${on ? '' : 'opacity-40'}`
  return (
    <div className={`flex min-h-16 items-center gap-1 pr-1.5 pl-1 ${first ? '' : 'border-line border-t'}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        aria-label={`${name} einbeziehen`}
        disabled={!food}
        onClick={onToggle}
        className="flex size-11 flex-none items-center justify-center"
      >
        <span
          className={`flex size-[22px] items-center justify-center rounded-[7px] border-2 ${
            on ? 'border-accent bg-accent text-on-accent' : 'border-chevron-muted'
          }`}
        >
          {on && <IconCheck size={14} strokeWidth={3} />}
        </span>
      </button>
      <span className={`flex min-w-0 flex-1 flex-col gap-0.5 ${fade}`}>
        <span className="text-body truncate font-medium">{name}</span>
        <span className="text-small text-muted">{formatNumber(lineNutrients(line, scale)?.kcal ?? null)} kcal</span>
      </span>
      <span className={`flex items-center ${fade}`}>
        <button
          type="button"
          aria-label={`Weniger ${name}`}
          disabled={!food}
          onClick={() => onStep(-1)}
          className="press text-muted flex size-11 items-center justify-center"
        >
          <IconMinus size={18} />
        </button>
        <button
          type="button"
          aria-label={`Menge ${name} eintippen`}
          aria-pressed={typing !== null}
          disabled={!food}
          onClick={onType}
          className={`text-body rounded-tile min-h-11 min-w-[66px] px-1 text-center font-semibold whitespace-nowrap ${
            typing !== null ? 'ring-accent ring-2' : ''
          }`}
        >
          {typing !== null && typing !== '' ? typing : formatAmount(scaledAmount(line, scale))} {unit}
        </button>
        <button
          type="button"
          aria-label={`Mehr ${name}`}
          disabled={!food}
          onClick={() => onStep(1)}
          className="press text-muted flex size-11 items-center justify-center"
        >
          <IconPlus size={18} strokeWidth={2} />
        </button>
      </span>
    </div>
  )
}
