// Eigener Ziffernblock 3 × 4: Tasten 54 hoch, Radius 14, Ziffern 22/500.
// Die Eingabelogik liegt in logic/keypad.ts.
import { applyKey, KEYPAD_LAYOUT, type KeypadKey } from '../../logic/keypad.ts'

type Props = {
  value: string
  onChange: (value: string) => void
  maxLength?: number
}

const labels: Partial<Record<KeypadKey, { text: string; aria: string }>> = {
  del: { text: '⌫', aria: 'Löschen' },
  ',': { text: ',', aria: 'Komma' },
}

export function Keypad({ value, onChange, maxLength }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYPAD_LAYOUT.map((key) => (
        <button
          key={key}
          type="button"
          aria-label={labels[key]?.aria ?? key}
          onClick={() => onChange(applyKey(value, key, maxLength))}
          className="press rounded-key bg-card text-keypad h-[54px] text-center"
        >
          {labels[key]?.text ?? key}
        </button>
      ))}
    </div>
  )
}
