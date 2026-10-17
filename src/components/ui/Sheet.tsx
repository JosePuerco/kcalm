// Bottom-Sheet nach Kern.dc.html: bis 772 px hoch, Radius oben 28, Griff 40 × 5,
// Scrim; Titel links, „Fertig“ rechts. Fährt mit Feder hoch, schließt schnell.
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { instant, motionTokens, useReduced } from '../../motion/motion.ts'
import { Button } from './Button.tsx'
import { Overlay } from './overlay.tsx'
import { useRegisterSheet } from './sheetRegistry.ts'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  doneLabel?: string
  children?: ReactNode
}

export function Sheet({ open, onClose, title, doneLabel = 'Fertig', children }: Props) {
  const reduced = useReduced()
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  useRegisterSheet(open)

  useEffect(() => {
    if (!open) return
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <Overlay>
      <AnimatePresence>
        {open && [
          <motion.div
            key="scrim"
            className="bg-scrim absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: reduced ? instant : motionTokens.scrimIn }}
            exit={{ opacity: 0, transition: reduced ? instant : motionTokens.scrimOut }}
          >
            <button type="button" aria-label="Schließen" className="absolute inset-0" onClick={onClose} />
          </motion.div>,
          <motion.div
            key="sheet"
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="bg-sheet rounded-t-sheet-top absolute inset-x-0 bottom-0 flex h-[min(772px,calc(100%-72px))] flex-col outline-none"
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: reduced ? instant : motionTokens.sheetIn }}
            exit={{ y: '100%', transition: reduced ? instant : motionTokens.sheetOut }}
          >
            <div className="bg-track mx-auto mt-2 mb-1 h-[5px] w-10 flex-none rounded-full" aria-hidden="true" />
            <div className="flex flex-none items-center justify-between pr-2 pl-4">
              <h2 id={titleId} className="text-sheet-title">
                {title}
              </h2>
              <Button variant="text" onClick={onClose}>
                {doneLabel}
              </Button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </motion.div>,
        ]}
      </AnimatePresence>
    </Overlay>
  )
}
