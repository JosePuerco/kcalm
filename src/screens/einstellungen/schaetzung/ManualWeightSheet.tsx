// Gewicht von Hand eintragen (eigenes Design im Stil des Schnelleintrags, mit Jan abgestimmt):
// Tag mit ‹ ›, große kg-Zahl, Ziffernblock, „Sichern“. Darunter „Letzte Gewichte“: Tipp = Tag bearbeiten,
// nach links wischen = löschen.
import { useState } from 'react'
import { IconBack, IconChevronRight } from '../../../components/icons/icons.tsx'
import { Button } from '../../../components/ui/Button.tsx'
import { Keypad } from '../../../components/ui/Keypad.tsx'
import { Sheet } from '../../../components/ui/Sheet.tsx'
import { SwipeRow } from '../../../components/ui/SwipeRow.tsx'
import { useToast } from '../../../components/ui/toastContext.ts'
import { deleteWeight, setManualWeight } from '../../../db/weights.ts'
import type { LocalDate, Weight } from '../../../db/types.ts'
import { addDays } from '../../../logic/dates.ts'
import { dayLabel } from '../../../logic/diary.ts'
import { manualWeightError } from '../../../logic/estimateView.ts'
import { formatNumber } from '../../../logic/format.ts'
import { parseKeypadValue } from '../../../logic/keypad.ts'

/** So viele Tage zeigt die Liste „Letzte Gewichte“ */
const RECENT = 14

type Props = {
  open: boolean
  onClose: () => void
  weights: readonly Weight[]
  today: LocalDate
}

const keypadText = (kg: number) => formatNumber(kg, 1).replace('.', '')

export function ManualWeightSheet({ open, onClose, weights, today }: Props) {
  const toast = useToast()
  const [date, setDate] = useState(today)
  const valueFor = (d: LocalDate) => {
    const w = weights.find((x) => x.date === d)
    return w ? keypadText(w.kg) : ''
  }
  const [value, setValue] = useState(() => valueFor(today))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [swiped, setSwiped] = useState<string | null>(null)

  const pick = (d: LocalDate) => {
    setDate(d)
    setValue(valueFor(d))
    setError(null)
  }
  const label = (d: LocalDate) => {
    const l = dayLabel(d, today)
    return l.relative ?? l.date
  }

  const save = async () => {
    const problem = manualWeightError(value)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    try {
      await setManualWeight(date, parseKeypadValue(value) as number)
      toast(`${label(date)}: ${formatNumber(parseKeypadValue(value), 1)} kg gesichert`)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const recent = weights.filter((w) => w.date > addDays(today, -RECENT)).toReversed()

  return (
    <Sheet open={open} onClose={onClose} title="Gewicht eintragen" doneLabel="Abbrechen">
      <div className="px-screen-x flex min-h-0 flex-1 flex-col pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="scroll-area -mx-1 flex flex-col gap-2 px-1 pt-0.5">
          <div className="bg-card rounded-field flex min-h-12 items-center justify-between">
            <button
              type="button"
              aria-label="Tag davor"
              onClick={() => pick(addDays(date, -1))}
              className="press text-text flex size-12 items-center justify-center"
            >
              <IconBack />
            </button>
            <span className="text-body-large font-semibold">{label(date)}</span>
            <button
              type="button"
              aria-label="Tag danach"
              disabled={date >= today}
              onClick={() => pick(addDays(date, 1))}
              className="press text-text flex size-12 items-center justify-center disabled:opacity-30"
            >
              <IconChevronRight />
            </button>
          </div>
          <div className="bg-card rounded-card ring-accent flex items-baseline justify-between px-4 py-3 ring-2">
            <span className="text-secondary text-muted">Gewicht</span>
            <span className="text-hero">
              {value || '–'}
              <span className="text-body-large text-muted font-medium"> kg</span>
            </span>
          </div>
          {recent.length > 0 && (
            <section className="pt-2">
              <h3 className="text-small text-muted px-1 pb-1.5 tracking-[0.6px] uppercase">Letzte Gewichte</h3>
              <div className="bg-card rounded-card overflow-hidden [&>*:first-child]:border-t-0">
                {recent.map((w) => (
                  <SwipeRow
                    key={w.id}
                    swiped={swiped === w.id}
                    anySwiped={swiped !== null}
                    onSwipe={(on) => setSwiped(on ? w.id : null)}
                    onTap={() => pick(w.date)}
                    onAction={() => {
                      setSwiped(null)
                      void deleteWeight(w.id).then(() => w.date === date && setValue(''))
                    }}
                    actionLabel="Löschen"
                    label={`${label(w.date)}, ${formatNumber(w.kg, 1)} kg`}
                  >
                    <div className="text-label flex min-h-12 items-center justify-between px-4">
                      <span>{label(w.date)}</span>
                      <span>
                        <span className="font-semibold">{formatNumber(w.kg, 1)} kg</span>
                        <span className="text-muted"> · {w.source === 'health' ? 'Health' : 'manuell'}</span>
                      </span>
                    </div>
                  </SwipeRow>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="pt-2">
          <Keypad
            value={value}
            onChange={(v) => {
              setValue(v)
              setError(null)
            }}
          />
        </div>
        {error && <p className="text-small text-danger px-1 pt-2">{error}</p>}
        <Button className="mt-2.5" disabled={busy} onClick={() => void save()}>
          Sichern
        </Button>
      </div>
    </Sheet>
  )
}
