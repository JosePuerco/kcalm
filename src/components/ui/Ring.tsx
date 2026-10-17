// Ring der Übersichtskarte: 142 px, Strich 12, Spur track.
// Akzent bis zum Ziel, orange (over) bei Überschreitung. Zahl in der Mitte zählt hoch.
import tokens from '../../../design/tokens.json'
import { AnimatedNumber } from './AnimatedNumber.tsx'

const SIZE = tokens.ring.size
const STROKE = tokens.ring.stroke
// Radius wie im Prototyp (r = 62 bei 142/12): 3 px Luft zum Rand
const R = SIZE / 2 - STROKE / 2 - 3
const CIRC = 2 * Math.PI * R

type Props = {
  /** Anteil gegessen am Ziel; über 1 = drüber, der Ring ist dann voll */
  progress: number
  /** Große Zahl in der Mitte (z. B. kcal übrig) */
  value: number
  label: string
  over?: boolean
}

export function Ring({ progress, value, label, over = false }: Props) {
  const frac = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0))
  return (
    <div className="relative flex-none" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} className="stroke-track" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${(CIRC * frac).toFixed(1)} ${CIRC.toFixed(1)}`}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          className={over ? 'stroke-over' : 'stroke-accent'}
          style={{
            transition:
              'stroke-dasharray var(--kc-motion-bars-and-ring-duration) var(--kc-motion-bars-and-ring-easing), stroke 200ms ease',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedNumber value={value} className="text-ring leading-none" />
        <span className="text-small text-muted mt-1">{label}</span>
      </div>
    </div>
  )
}
