// Eintragszeile nach Kern.dc.html: Name + Menge (muted), kcal rechts; Tipp = bearbeiten;
// nach links wischen zeigt „Löschen“ (88 px, danger), Schwelle 44 px, rastet mit Feder ein (motion.rowSwipeSnap).
import { useRef, useState, type PointerEvent } from 'react'
import type { Entry } from '../../db/types.ts'
import { formatAmount, formatNumber } from '../../logic/format.ts'

const OPEN = -88
const THRESHOLD = -44
const MAX = -110
/** Ab so viel Bewegung ist es ein Wischen und kein Tipp */
const MOVE_SLOP = 6

type Props = {
  entry: Entry
  flash: boolean
  swiped: boolean
  /** irgendeine Zeile ist aufgewischt: ein Tipp schließt sie, statt zu bearbeiten */
  anySwiped: boolean
  onSwipe: (open: boolean) => void
  onTap: () => void
  onDelete: () => void
}

export function EntryRow({ entry, flash, swiped, anySwiped, onSwipe, onTap, onDelete }: Props) {
  const drag = useRef<{ x: number; base: number; moved: boolean } | null>(null)
  const moved = useRef(false)
  const [dx, setDx] = useState<number | null>(null)
  const offset = dx ?? (swiped ? OPEN : 0)
  const amount = entry.amount === null || entry.unit === null ? null : `${formatAmount(entry.amount)} ${entry.unit}`

  const down = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, base: swiped ? OPEN : 0, moved: false }
    moved.current = false
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const delta = e.clientX - d.x
    if (!d.moved && Math.abs(delta) > MOVE_SLOP) {
      d.moved = true
      // Ab jetzt gehört die Bewegung dieser Zeile, auch wenn der Finger sie verlässt
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Zeiger schon weg (z. B. abgebrochene Geste): Wischen geht trotzdem
      }
    }
    if (d.moved) setDx(Math.max(MAX, Math.min(0, d.base + delta)))
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    if (!d?.moved) return
    moved.current = true
    onSwipe((dx ?? 0) < THRESHOLD)
    setDx(null)
  }
  const click = () => {
    // Ein Wischen löst danach noch einen Klick aus; den ignorieren
    if (moved.current) {
      moved.current = false
      return
    }
    if (anySwiped) onSwipe(false)
    else onTap()
  }

  return (
    <div className="border-line relative overflow-hidden border-t">
      <button
        type="button"
        onClick={onDelete}
        tabIndex={swiped ? 0 : -1}
        aria-hidden={!swiped}
        className="bg-danger text-on-accent text-label absolute inset-y-0 right-0 flex w-[88px] items-center justify-center font-semibold"
      >
        Löschen
      </button>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${entry.nameSnapshot}${amount ? `, ${amount}` : ''}, ${formatNumber(entry.nutrients.kcal)} kcal, bearbeiten`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={click}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onTap())}
        className="bg-card relative cursor-pointer touch-pan-y"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dx === null ? 'transform var(--kc-motion-row-swipe-snap-duration) var(--kc-motion-row-swipe-snap-easing)' : 'none',
        }}
      >
        <div
          className={`text-label flex min-h-10 items-center justify-between gap-3 rounded-[8px] pr-3 ${flash ? 'flash-new' : ''}`}
        >
          <span className="min-w-0">
            {entry.nameSnapshot}
            {amount && <span className="text-muted"> {amount}</span>}
          </span>
          <span className="text-muted whitespace-nowrap">{formatNumber(entry.nutrients.kcal)}</span>
        </div>
      </div>
    </div>
  )
}
