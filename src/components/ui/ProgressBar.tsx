// Fortschrittsleiste: Spur track, Füllung text (Makros) oder accent (Wasser).
// Höhe 5 (Makros Übersicht), 4 (Wasser), 8 (Makros Statistik).
type Props = {
  /** Anteil 0–1; größere Werte werden bei 1 abgeschnitten */
  value: number
  height?: 4 | 5 | 8
  tone?: 'text' | 'accent'
  label?: string
}

const heights = { 4: 'h-1', 5: 'h-[5px]', 8: 'h-2' } as const

export function ProgressBar({ value, height = 5, tone = 'text', label }: Props) {
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
        className={`rounded-full ${heights[height]} ${tone === 'accent' ? 'bg-accent' : 'bg-text'}`}
        style={{
          width: `${pct}%`,
          transition: 'width var(--kc-motion-bars-and-ring-duration) var(--kc-motion-bars-and-ring-easing)',
        }}
      />
    </div>
  )
}
