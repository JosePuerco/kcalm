// Fortschrittsleiste: Spur track, Füllung text.
// Höhe 5 (Makros Übersicht), 8 (Makros Statistik).
type Props = {
  /** Anteil 0–1; größere Werte werden bei 1 abgeschnitten */
  value: number
  height?: 5 | 8
  label?: string
}

const heights = { 5: 'h-[5px]', 8: 'h-2' } as const

export function ProgressBar({ value, height = 5, label }: Props) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100
  return (
    <div
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuenow={label ? Math.round(pct) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      className={`bg-track w-full rounded-full ${heights[height]}`}
    >
      <div
        className={`rounded-full bg-text ${heights[height]}`}
        style={{
          width: `${pct}%`,
          transition: 'width var(--kc-motion-bars-and-ring-duration) var(--kc-motion-bars-and-ring-easing)',
        }}
      />
    </div>
  )
}
