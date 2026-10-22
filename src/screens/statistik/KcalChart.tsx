// kcal pro Tag (bzw. Ø je Woche): Balken gegen gestrichelte Ziellinie.
// Die ganze Fläche hört auf den Finger: Tipp wählt den nächsten Balken, Wischen wandert,
// erneuter Tipp auf denselben Balken hebt die Auswahl auf. Senkrecht scrollt die Seite weiter.
import { useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { Card } from '../../components/ui/Card.tsx'
import { formatNumber } from '../../logic/format.ts'
import { nearestBar, type Stats } from '../../logic/stats.ts'

// Breite des Streifens rechts für die Zielzahl („2.800“ in 11 px plus Abstand zur Linie)
const GUTTER = 'w-9'

const barTransition = 'height var(--kc-motion-bars-and-ring-duration) var(--kc-motion-bars-and-ring-easing)'

export function KcalChart({ stats }: { stats: Stats }) {
  const { bars, scale, goalLine, range } = stats
  // Auswahl gehört zum Zeitraum: beim Wechsel aufgehoben, die Balken animieren trotzdem weiter
  const [pick, setPick] = useState<{ range: Stats['range']; index: number } | null>(null)
  const selected = pick?.range === range ? pick.index : null
  const setSelected = (index: number | null) => setPick(index === null ? null : { range, index })
  const area = useRef<HTMLDivElement>(null)
  // Fingerbewegung: Startbalken, ob gewischt wurde, Auswahl vor dem Tipp
  const drag = useRef<{ start: number; moved: boolean; before: number | null } | null>(null)

  const indexAt = (e: PointerEvent) => {
    const rect = area.current?.getBoundingClientRect()
    return rect ? nearestBar(e.clientX - rect.left, rect.width, bars.length) : -1
  }

  const onPointerDown = (e: PointerEvent) => {
    const i = indexAt(e)
    if (i < 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { start: i, moved: false, before: selected }
    setSelected(i)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!drag.current) return
    const i = indexAt(e)
    if (i < 0) return
    if (i !== drag.current.start) drag.current.moved = true
    setSelected(i)
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (!d.moved && d.before === d.start) setSelected(null)
  }
  // Browser übernimmt (z. B. senkrechtes Scrollen): Auswahl bleibt wie zuletzt
  const onPointerCancel = () => {
    drag.current = null
  }

  // Tastatur und Bedienhilfen (detail 0) aktivieren den Knopf direkt; Maus und Finger erledigt die Fläche
  const onBarClick = (e: MouseEvent, i: number) => {
    if (e.detail !== 0) return
    setSelected(selected === i ? null : i)
  }

  const pct = (kcal: number) => `${((Math.min(kcal, scale) / scale) * 100).toFixed(1)}%`
  const sel = selected !== null ? bars[selected] : undefined
  const hint = range === 'quarter' ? 'Ø/Tag je Woche' : 'Tippe auf einen Balken'
  const empty = bars.every((b) => b.kcal === null)
  const gap = bars.length > 14 ? 'gap-[3px]' : 'gap-2'

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-body font-semibold">kcal pro Tag</h2>
        <span className="text-secondary text-muted truncate" aria-live="polite">
          {sel ? sel.caption : empty ? '' : hint}
        </span>
      </div>

      {empty ? (
        <p className="text-secondary text-muted mt-3 flex h-[150px] items-center justify-center text-center">
          Keine Einträge in diesem Zeitraum
        </p>
      ) : (
        <>
          <div className="mt-3 flex h-[150px]">
            <div
              ref={area}
              className="relative min-w-0 flex-1 touch-pan-y select-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
            >
              {goalLine !== null && (
                <div
                  aria-hidden="true"
                  className="border-muted absolute right-0 left-0 border-t-[1.5px] border-dashed opacity-50"
                  style={{ bottom: pct(goalLine) }}
                />
              )}
              <div className={`absolute inset-0 flex items-end ${gap}`}>
                {bars.map((b, i) => (
                  <button
                    key={b.date}
                    type="button"
                    aria-label={b.caption}
                    aria-pressed={selected === i}
                    onClick={(e) => onBarClick(e, i)}
                    className="flex h-full min-w-0 flex-1 items-end"
                  >
                    <span
                      className={`rounded-t-bar-top block w-full rounded-b-[2px] ${b.full ? 'bg-accent' : 'bg-neutral-bar'}`}
                      style={{
                        height: b.kcal?.value ? pct(b.kcal.value) : 0,
                        opacity: selected === null || selected === i ? 1 : 0.45,
                        transition: `${barTransition}, opacity 200ms ease`,
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
            {/* Eigener Streifen für die Zielzahl, damit kein Balken sie überdeckt; mittig auf der Linie */}
            <div aria-hidden="true" className={`relative shrink-0 ${GUTTER}`}>
              {goalLine !== null && (
                <span
                  className="text-tiny text-muted absolute right-0 translate-y-1/2"
                  style={{ bottom: pct(goalLine) }}
                >
                  {formatNumber(goalLine)}
                </span>
              )}
            </div>
          </div>

          {/* Beschriftung mittig unter ihrem Balken; breitere Texte stehen gleichmäßig zu beiden Seiten über */}
          <div className="mt-1.5 flex" aria-hidden="true">
            <div className={`flex min-w-0 flex-1 ${gap}`}>
              {bars.map((b) => (
                <span key={b.date} className="text-tiny text-muted flex min-w-0 flex-1 justify-center whitespace-nowrap">
                  {b.label}
                </span>
              ))}
            </div>
            <div className={`shrink-0 ${GUTTER}`} />
          </div>

          <div className="text-small text-muted mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1">
            <Legend swatch="bg-accent">vollständig</Legend>
            <Legend swatch="bg-neutral-bar">unvollständig</Legend>
            {goalLine !== null && (
              <span className="flex items-center gap-1.5">
                <span className="border-muted w-3.5 border-t-[1.5px] border-dashed opacity-50" />
                Tagesziel
              </span>
            )}
          </div>
        </>
      )}
    </Card>
  )
}

function Legend({ swatch, children }: { swatch: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`rounded-bar-top size-2.5 ${swatch}`} />
      {children}
    </span>
  )
}
