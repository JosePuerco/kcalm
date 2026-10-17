// Zahl, die bei Änderung in 650 ms hochzählt (motion.numberTween).
// Bei „Bewegung reduzieren“ springt sie sofort auf den neuen Wert.
import { animate } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { formatNumber } from '../../logic/format.ts'
import { motionTokens, useReduced } from '../../motion/motion.ts'

type Props = { value: number; decimals?: number; className?: string }

export function AnimatedNumber({ value, decimals = 0, className }: Props) {
  const reduced = useReduced()
  const [shown, setShown] = useState(value)
  const from = useRef(value)

  useEffect(() => {
    if (reduced) {
      from.current = value
      return
    }
    const controls = animate(from.current, value, {
      ...motionTokens.numberTween,
      onUpdate: (v) => {
        from.current = v
        setShown(v)
      },
    })
    return () => controls.stop()
  }, [value, reduced])

  return <span className={className}>{formatNumber(reduced ? value : shown, decimals)}</span>
}
