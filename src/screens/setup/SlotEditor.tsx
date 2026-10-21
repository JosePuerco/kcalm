// Slot-Editor (Ersteinrichtung Schritt 1, Einstellungen → Mahlzeiten-Slots). Eigenes Design im Stil
// von Start.dc.html (kein Prototyp, mit Jan abgestimmt): je Slot Name, Uhrzeit von–bis, Reihenfolge, Entfernen.
import type { ReactNode } from 'react'
import { IconChevronDown, IconChevronUp, IconPlus, IconTrash } from '../../components/icons/icons.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { MAX_SLOTS, type SlotErrors, type SlotInput } from '../../logic/slots.ts'

type Props = {
  slots: SlotInput[]
  errors: SlotErrors
  general?: string
  onChange: (slots: SlotInput[]) => void
}

export function SlotEditor({ slots, errors, general, onChange }: Props) {
  const update = (index: number, changes: Partial<SlotInput>) =>
    onChange(slots.map((s, i) => (i === index ? { ...s, ...changes } : s)))
  const move = (index: number, by: -1 | 1) => {
    const next = [...slots]
    const [slot] = next.splice(index, 1)
    if (slot) next.splice(index + by, 0, slot)
    onChange(next)
  }

  return (
    <>
      <Card padded={false} className="px-card-padding">
        {slots.map((slot, i) => {
          const e = errors[i]
          return (
            // Neue Slots haben noch keine id; Index reicht, weil Verschieben ganze Werte mitnimmt
            <div key={slot.id ?? `neu-${i}`} className={`flex flex-col py-1.5 ${i > 0 ? 'border-line border-t' : ''}`}>
              <div className="flex items-center gap-1">
                <input
                  aria-label={`Name Slot ${i + 1}`}
                  aria-invalid={e?.name ? true : undefined}
                  value={slot.name}
                  placeholder="Name"
                  autoComplete="off"
                  enterKeyHint="done"
                  onChange={(ev) => update(i, { name: ev.target.value })}
                  className="text-body-large text-text placeholder:text-muted min-h-touch-min min-w-0 flex-1 bg-transparent font-semibold outline-none"
                />
                <IconButton label={`${slot.name || 'Slot'} nach oben`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <IconChevronUp />
                </IconButton>
                <IconButton
                  label={`${slot.name || 'Slot'} nach unten`}
                  disabled={i === slots.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <IconChevronDown />
                </IconButton>
                <IconButton
                  label={`${slot.name || 'Slot'} entfernen`}
                  disabled={slots.length === 1}
                  onClick={() => onChange(slots.filter((_, j) => j !== i))}
                >
                  <IconTrash />
                </IconButton>
              </div>
              <div className="text-secondary text-muted flex items-center gap-2">
                <span className="w-14">Uhrzeit</span>
                <TimeInput label={`${slot.name || 'Slot'} von`} value={slot.timeFrom} onChange={(v) => update(i, { timeFrom: v })} />
                <span aria-hidden="true">–</span>
                <TimeInput label={`${slot.name || 'Slot'} bis`} value={slot.timeTo} onChange={(v) => update(i, { timeTo: v })} />
              </div>
              {(e?.name || e?.time) && <span className="text-small text-danger pb-1">{e.name ?? e.time}</span>}
            </div>
          )
        })}
      </Card>
      {general && <p className="text-small text-danger px-1">{general}</p>}
      {slots.length < MAX_SLOTS && (
        <button
          type="button"
          onClick={() => onChange([...slots, { name: '', timeFrom: '', timeTo: '' }])}
          className="press bg-card rounded-card text-accent-text text-body flex min-h-[52px] items-center gap-2.5 px-4 font-semibold"
        >
          <IconPlus size={18} strokeWidth={2} />
          Slot hinzufügen
        </button>
      )}
    </>
  )
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="press text-muted min-w-touch-min min-h-touch-min flex items-center justify-center disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="time"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      // 16 px, sonst zoomt iOS beim Antippen
      className="text-body-large text-text bg-segment-track-in-card rounded-tile min-h-touch-min w-[92px] px-2 text-center outline-none"
    />
  )
}
