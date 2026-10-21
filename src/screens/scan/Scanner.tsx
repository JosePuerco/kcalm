// Scanner nach Scanner.dc.html: Vollbild-Kamera, außerhalb des Rahmens abgedunkelt (290 × 170, Ecken
// weiß, Laser), oben Schließen und Taschenlampe, unten „Code eintippen“. Wird nur geladen, wenn der
// Scanner geöffnet wird (React.lazy), damit Decoder und WASM den App-Start nicht bremsen.
// Ein Code gilt erst nach zwei gleichen Lesungen (scanConfirm.ts). Was danach passiert, entscheidet
// der Aufrufer (onDetected); mit paused ruht die Erkennung, z. B. solange eine Trefferkarte offen ist.
import { motion } from 'motion/react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { IconClose, IconTorch } from '../../components/icons/icons.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { TextField } from '../../components/ui/TextField.tsx'
import { normalizeBarcode } from '../../logic/barcode.ts'
import { emptyScan, firstValidCode, nextScan } from '../../logic/scanConfirm.ts'
import { instant, motionTokens, useReduced } from '../../motion/motion.ts'
import { createDetector } from '../../scanner/detector.ts'
import { useCamera, type CameraStatus } from './useCamera.ts'

/** Pause zwischen zwei Bildern; ZXing braucht auf dem iPhone ca. 30–60 ms pro Bild */
const SCAN_INTERVAL_MS = 120

type Detector = Awaited<ReturnType<typeof createDetector>>

type Props = {
  onDetected: (code: string) => void
  onClose: () => void
  paused?: boolean
  /** Karte unten über „Code eintippen“, z. B. der Treffer */
  children?: ReactNode
}

const MESSAGES: Record<Exclude<CameraStatus, 'running'>, string> = {
  starting: 'Barcode in den Rahmen halten',
  denied: 'Kein Zugriff auf die Kamera. Erlaube ihn in den iPhone-Einstellungen oder tippe den Code ein.',
  unavailable: 'Kamera nicht verfügbar. Tippe den Code ein.',
}

export default function Scanner({ onDetected, onClose, paused = false, children }: Props) {
  const reduced = useReduced()
  const video = useRef<HTMLVideoElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const camera = useCamera(video)
  const [detector, setDetector] = useState<Detector | null>(null)
  const [detectorFailed, setDetectorFailed] = useState(false)
  const [typing, setTyping] = useState(false)

  // Decoder parallel zur Kamera laden
  useEffect(() => {
    let cancelled = false
    createDetector().then(
      (d) => !cancelled && setDetector(d),
      (error: unknown) => {
        console.error(error)
        if (!cancelled) setDetectorFailed(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  // Erkennung: Bild für Bild, nie zwei Abfragen gleichzeitig
  const onDetectedRef = useRef(onDetected)
  useEffect(() => {
    onDetectedRef.current = onDetected
  })
  const scanning = camera.status === 'running' && detector !== null && !paused && !typing
  useEffect(() => {
    if (!scanning || !detector) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let state = emptyScan
    const tick = async () => {
      const el = video.current
      if (el && el.readyState >= el.HAVE_CURRENT_DATA) {
        try {
          const result = nextScan(state, firstValidCode(await detector.detect(el)))
          state = result.state
          if (result.confirmed && !stopped) {
            stopped = true
            onDetectedRef.current(result.confirmed)
            return
          }
        } catch (error) {
          console.error(error)
        }
      }
      if (!stopped) timer = setTimeout(() => void tick(), SCAN_INTERVAL_MS)
    }
    void tick()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [scanning, detector])

  // Escape schließt nur den Scanner, nicht das Sheet darunter
  useEffect(() => {
    dialog.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [onClose])

  const message = detectorFailed
    ? 'Scanner konnte nicht geladen werden. Tippe den Code ein.'
    : MESSAGES[camera.status === 'running' ? 'starting' : camera.status]

  return (
    <motion.div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Barcode scannen"
      tabIndex={-1}
      className="bg-scanner-bg text-scanner-text absolute inset-0 z-10 overflow-hidden outline-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: reduced ? instant : motionTokens.scrimIn }}
    >
      <video ref={video} className="absolute inset-0 size-full object-cover" autoPlay muted playsInline />

      {!typing && (
        <>
          {/* Rahmen; der riesige Schatten dunkelt alles außerhalb ab */}
          <div aria-hidden="true" className="absolute top-1/2 left-1/2 h-[170px] w-[290px] -translate-x-1/2 -translate-y-1/2">
            <div className="rounded-scan-frame absolute inset-0 shadow-[0_0_0_1000px_var(--color-scanner-mask)]" />
            <span className="border-scanner-text rounded-tl-scan-frame absolute top-0 left-0 size-[34px] border-t-4 border-l-4" />
            <span className="border-scanner-text rounded-tr-scan-frame absolute top-0 right-0 size-[34px] border-t-4 border-r-4" />
            <span className="border-scanner-text rounded-bl-scan-frame absolute bottom-0 left-0 size-[34px] border-b-4 border-l-4" />
            <span className="border-scanner-text rounded-br-scan-frame absolute right-0 bottom-0 size-[34px] border-r-4 border-b-4" />
            {scanning && <div className="bg-scanner-laser shadow-laser scan-laser absolute inset-x-[22px] top-[84px] h-0.5" />}
          </div>
          <p
            role="status"
            className="text-label text-scanner-hint absolute inset-x-0 top-[calc(50%+105px)] px-8 text-center"
          >
            {message}
          </p>
        </>
      )}

      <div className="absolute inset-x-0 top-[max(calc(env(safe-area-inset-top)+3px),50px)] flex items-center justify-between px-2">
        <button
          type="button"
          aria-label="Schließen"
          onClick={onClose}
          className="press bg-scanner-control flex size-11 items-center justify-center rounded-full"
        >
          <IconClose size={20} />
        </button>
        <h2 className="text-body-large font-semibold">Barcode scannen</h2>
        {camera.torch.supported && !typing ? (
          <button
            type="button"
            aria-label="Taschenlampe"
            aria-pressed={camera.torch.on}
            onClick={() => void camera.toggleTorch()}
            className={`press flex size-11 items-center justify-center rounded-full ${camera.torch.on ? 'bg-scanner-text text-scanner-bg' : 'bg-scanner-control'}`}
          >
            <IconTorch />
          </button>
        ) : (
          <span className="size-11" aria-hidden="true" />
        )}
      </div>

      {typing ? (
        <ManualEntry
          onSubmit={(code) => {
            setTyping(false)
            onDetected(code)
          }}
          onCancel={() => setTyping(false)}
        />
      ) : (
        <div className="absolute inset-x-4 bottom-[max(env(safe-area-inset-bottom),34px)] flex flex-col gap-2.5">
          {children}
          <button
            type="button"
            onClick={() => setTyping(true)}
            className="press bg-scanner-mask rounded-button text-body min-h-12 text-center font-medium"
          >
            Code eintippen
          </button>
        </div>
      )}
    </motion.div>
  )
}

/** Code von Hand, falls der Scan nicht klappt. Oben statt unten, damit die Tastatur nichts verdeckt. */
function ManualEntry({ onSubmit, onCancel }: { onSubmit: (code: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | undefined>()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const digits = value.replace(/[\s-]/g, '')
    if (!/^\d{8}$|^\d{12,13}$/.test(digits)) return setError('8, 12 oder 13 Ziffern')
    const code = normalizeBarcode(digits)
    if (!code) return setError('Prüfziffer stimmt nicht – bitte den Code prüfen')
    onSubmit(code)
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      className="bg-card text-text rounded-card absolute inset-x-4 top-[max(calc(env(safe-area-inset-top)+59px),106px)] flex flex-col gap-2 px-4 pt-2 pb-4"
    >
      <TextField
        label="Barcode (Ziffern unter den Strichen)"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setError(undefined)
        }}
        error={error}
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="search"
        autoFocus
        placeholder="z. B. 4000417025005"
      />
      <Button type="submit">Suchen</Button>
      <Button variant="text" className="justify-center" onClick={onCancel}>
        Abbrechen
      </Button>
    </form>
  )
}
