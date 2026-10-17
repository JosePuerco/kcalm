// Segment-Umschalter (Lebensmittel, Statistik, Einstellungen):
// Spur segmentTrack (in Karten segmentTrackInCard), Radius 12, 3 px Innenabstand;
// aktives Segment segmentActive mit leichtem Schatten, 13/600.
type Option<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  options: readonly Option<T>[]
  value: T
  onChange: (value: T) => void
  /** Liegt der Umschalter in einer Karte? Dann hellere Spur */
  inCard?: boolean
  label: string
}

export function Segmented<T extends string>({ options, value, onChange, inCard = false, label }: Props<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`rounded-segment grid gap-1 p-[3px] ${inCard ? 'bg-segment-track-in-card' : 'bg-segment-track'}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`rounded-segment-item text-secondary min-h-9 text-center font-semibold transition-colors duration-200 ${
              active ? 'bg-segment-active text-text shadow-segment-active' : 'text-muted'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
