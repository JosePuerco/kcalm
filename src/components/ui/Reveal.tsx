// Aufgeklappter Inhalt (Slot, Woche, Kalender): gleitet 8 px von oben ein (motion.expand).
// Bei „Bewegung reduzieren“ sofort da.
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { instant, motionTokens, useReduced } from '../../motion/motion.ts'

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReduced()
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: motionTokens.expandOffsetY }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? instant : motionTokens.expand}
    >
      {children}
    </motion.div>
  )
}
