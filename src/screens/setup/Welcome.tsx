// Willkommen (Schritt 0 der Ersteinrichtung, kein Prototyp, mit Jan abgestimmt):
// App-Icon, dessen Ring sich einmal zeichnet, darunter Name und ein Satz; unten zwei Wege:
// „Neu einrichten“ (Schritte 1–4) oder „Aus Backup laden“ (direkt ins Tagebuch).
// Bewegung reduzieren: alles steht sofort da.
import { motion } from 'motion/react'
import { Button } from '../../components/ui/Button.tsx'
import { instant, motionTokens, useReduced } from '../../motion/motion.ts'

// Icon wie public/icon-512.png: Ring r = 0,26 und Strich 0,085 der Kantenlänge, Bogen 252° (70 %)
const ICON = 96
const R = ICON * 0.26
const STROKE = ICON * 0.085
const ARC = 0.7

type Props = {
  onStart: () => void
  onRestore: () => void
}

export function Welcome({ onStart, onRestore }: Props) {
  const reduced = useReduced()
  // Nacheinander einblenden: 8 px von unten (wie beim Aufklappen), versetzt um delay Sekunden
  const rise = (delay: number) =>
    reduced
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: -motionTokens.expandOffsetY },
          animate: { opacity: 1, y: 0, transition: { ...motionTokens.expand, delay } },
        }

  return (
    <>
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
        <motion.div
          className="bg-accent rounded-calendar flex items-center justify-center"
          style={{ width: ICON, height: ICON }}
          initial={reduced ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1, transition: reduced ? instant : motionTokens.toast }}
        >
          <svg width={ICON} height={ICON} viewBox={`0 0 ${ICON} ${ICON}`} aria-hidden="true">
            <circle cx={ICON / 2} cy={ICON / 2} r={R} fill="none" strokeWidth={STROKE} className="stroke-on-accent" strokeOpacity={0.28} />
            <motion.circle
              cx={ICON / 2}
              cy={ICON / 2}
              r={R}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              className="stroke-on-accent"
              transform={`rotate(-90 ${ICON / 2} ${ICON / 2})`}
              initial={reduced ? false : { pathLength: 0 }}
              animate={{ pathLength: ARC, transition: reduced ? instant : { ...motionTokens.numberTween, delay: 0.25 } }}
            />
          </svg>
        </motion.div>
        <motion.h1 className="text-title mt-6" {...rise(0.45)}>
          Kcalm
        </motion.h1>
        <motion.p className="text-label text-muted mt-2 max-w-[17rem] leading-[1.45]" {...rise(0.55)}>
          Kalorien ruhig tracken. Alle Daten bleiben auf deinem iPhone.
        </motion.p>
      </main>

      <motion.div
        className="px-screen-x flex shrink-0 flex-col gap-2.5 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))]"
        {...rise(0.7)}
      >
        <Button className="w-full" onClick={onStart}>
          Neu einrichten
        </Button>
        <Button variant="secondary" className="w-full" onClick={onRestore}>
          Aus Backup laden
        </Button>
      </motion.div>
    </>
  )
}
