// Was nach einem Scan über dem Kamerabild erscheint:
//  HitCard        Treffer (Scanner.dc.html): Name, Quelle · kcal/100 · EAN, „Weiter“
//  LoadingCard    während der Abfrage bei Open Food Facts
//  MissingSheet   nicht in OFF bzw. in OFF ohne kcal (NichtGefunden.dc.html, Zustand 1)
//  OfflineSheet   kein Internet / OFF nicht erreichbar, Code gemerkt (NichtGefunden.dc.html, Zustand 2)
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { IconCheck, IconOffline, IconSearchOff } from '../../components/icons/icons.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { per100Label, type FoodChoice } from '../../logic/addFood.ts'
import { formatEan } from '../../logic/barcode.ts'
import { instant, motionTokens, useReduced } from '../../motion/motion.ts'

export function HitCard({ food, code, onNext }: { food: FoodChoice; code: string; onNext: () => void }) {
  return (
    <div className="bg-card text-text rounded-calendar flex items-center gap-3 py-3.5 pr-3.5 pl-4">
      <span className="bg-accent-soft text-accent-text rounded-tile flex size-10 flex-none items-center justify-center">
        <IconCheck size={20} strokeWidth={2.2} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body font-semibold break-words">{food.name}</span>
        <span className="text-small text-muted">
          {food.source} · {per100Label(food)} · EAN {code}
        </span>
      </span>
      <button
        type="button"
        onClick={onNext}
        className="press bg-accent text-on-accent rounded-field text-body min-h-touch-min flex-none px-4 font-semibold"
      >
        Weiter
      </button>
    </div>
  )
}

export function LoadingCard({ code }: { code: string }) {
  return (
    <div role="status" className="bg-card text-muted rounded-calendar text-label flex min-h-[68px] items-center px-4">
      Suche EAN {code} …
    </div>
  )
}

/** Sheet unten über dem abgedunkelten Kamerabild */
function ResultSheet({ label, children }: { label: string; children: ReactNode }) {
  const reduced = useReduced()
  return (
    <div className="absolute inset-0 z-10" role="dialog" aria-modal="true" aria-label={label}>
      <motion.div
        aria-hidden="true"
        className="bg-scanner-mask absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: reduced ? instant : motionTokens.scrimIn }}
      />
      <motion.div
        className="bg-sheet text-text rounded-t-sheet-top absolute inset-x-0 bottom-0 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),34px)]"
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: reduced ? instant : motionTokens.sheetIn }}
      >
        <div className="bg-track mx-auto mb-[18px] h-[5px] w-10 rounded-full" aria-hidden="true" />
        {children}
      </motion.div>
    </div>
  )
}

function SheetHead({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-3 pb-5 text-center">
      <span className="bg-card text-muted rounded-card flex size-14 items-center justify-center">{icon}</span>
      <h2 className="text-unit font-semibold">{title}</h2>
      <p className="text-label text-muted leading-[1.45]">{text}</p>
      {children}
    </div>
  )
}

type MissingProps = {
  code: string
  /** true: bei OFF eingetragen, aber ohne kcal */
  noNutrients: boolean
  onCreate: () => void
  onSearchLocal: () => void
  onRescan: () => void
}

export function MissingSheet({ code, noNutrients, onCreate, onSearchLocal, onRescan }: MissingProps) {
  return (
    <ResultSheet label={noNutrients ? 'Ohne Nährwerte' : 'Nicht gefunden'}>
      <SheetHead
        icon={<IconSearchOff />}
        title={noNutrients ? 'Ohne Nährwerte in Open Food Facts' : 'Nicht in Open Food Facts'}
        text={
          noNutrients
            ? 'Das Produkt ist eingetragen, aber ohne Kalorien. Ergänze die Werte vom Etikett – Name und bekannte Werte sind schon ausgefüllt.'
            : 'Zu diesem Barcode gibt es noch kein Produkt. Lege es mit den Werten vom Etikett an, dann findet Kcalm es beim nächsten Scan sofort.'
        }
      >
        <span className="text-secondary text-muted bg-card rounded-small-button mt-1 px-3 py-1.5">EAN {formatEan(code)}</span>
      </SheetHead>
      <div className="flex flex-col gap-2">
        <Button onClick={onCreate}>Eigenes Produkt anlegen</Button>
        <button
          type="button"
          onClick={onSearchLocal}
          className="press bg-card rounded-button text-body min-h-12 text-center font-medium"
        >
          Lokal suchen
        </button>
        <button
          type="button"
          onClick={onRescan}
          className="press text-accent-text text-body min-h-touch-min text-center font-medium"
        >
          Nochmal scannen
        </button>
      </div>
    </ResultSheet>
  )
}

type OfflineProps = {
  /** offline = kein Netz; unreachable = Netz da, OFF antwortet nicht (mit Jan abgestimmt) */
  reason: 'offline' | 'unreachable'
  rememberedFor: string
  openScans: number
  onManual: () => void
  onLater: () => void
}

export function OfflineSheet({ reason, rememberedFor, openScans, onManual, onLater }: OfflineProps) {
  return (
    <ResultSheet label={reason === 'offline' ? 'Kein Internet' : 'Nicht erreichbar'}>
      <SheetHead
        icon={<IconOffline />}
        title={reason === 'offline' ? 'Kein Internet' : 'Open Food Facts nicht erreichbar'}
        text={
          reason === 'offline'
            ? 'Der Barcode ist gemerkt. Sobald du online bist, lädt Kcalm das Produkt und fragt dich nach der Menge.'
            : 'Der Barcode ist gemerkt. Sobald Open Food Facts wieder antwortet, lädt Kcalm das Produkt und fragt dich nach der Menge.'
        }
      />
      <div className="bg-card rounded-card text-label mb-2.5 px-4 py-1">
        <div className="flex min-h-12 items-center justify-between">
          <span>Gemerkt für</span>
          <span className="font-semibold">{rememberedFor}</span>
        </div>
        <div className="border-line flex min-h-12 items-center justify-between border-t">
          <span>Offene Scans</span>
          <span className="font-semibold">{openScans}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Button onClick={onManual}>Jetzt manuell eintragen</Button>
        <button
          type="button"
          onClick={onLater}
          className="press bg-card rounded-button text-body min-h-12 text-center font-medium"
        >
          Später
        </button>
      </div>
    </ResultSheet>
  )
}
