// Toast unten: text als Fläche, Häkchen, 2,2 s sichtbar.
// Über der Navigation (100 px), bei offenem Sheet tiefer (40 px) wie im Prototyp.
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { instant, motionTokens, useReduced } from '../../motion/motion.ts'
import { IconCheck } from '../icons/icons.tsx'
import { Overlay } from './overlay.tsx'
import { useAnySheetOpen } from './sheetRegistry.ts'
import { ToastContext } from './toastContext.ts'

type ToastState = { id: number; message: string } | null

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null)
  const nextId = useRef(1)

  const show = useCallback((message: string) => {
    setToast({ id: nextId.current++, message })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), motionTokens.toastVisibleMs)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <ToastView toast={toast} />
    </ToastContext.Provider>
  )
}

function ToastView({ toast }: { toast: ToastState }) {
  const reduced = useReduced()
  const sheetOpen = useAnySheetOpen()
  return (
    <Overlay>
      <div role="status" aria-live="polite" className="pointer-events-none! absolute inset-x-6 z-30" style={{ bottom: sheetOpen ? 40 : 100 }}>
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              className="bg-text text-bg rounded-button text-label absolute inset-x-0 bottom-0 flex items-center gap-2.5 px-4 py-3"
              initial={reduced ? false : { opacity: 0, y: 12, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: reduced ? instant : motionTokens.toast }}
              exit={{ opacity: 0, transition: instant }}
            >
              <IconCheck className="flex-none" />
              <span>{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Overlay>
  )
}
