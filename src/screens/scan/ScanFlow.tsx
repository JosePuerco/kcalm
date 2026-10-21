// Ablauf nach dem Scan (PLAN.md 2, Barcode): lokal, sonst Open Food Facts; Treffer → direkt zum Mengen-Schritt,
// nicht gefunden / ohne kcal → eigenes Produkt mit Barcode, offline → Code merken.
// Wird mit dem Scanner nachgeladen (React.lazy in AddSheet).
import { useRef, useState } from 'react'
import { useToast } from '../../components/ui/toastContext.ts'
import { lookupBarcode } from '../../db/off.ts'
import { addPendingScan, getPendingScans, resolvePendingScan } from '../../db/pendingScans.ts'
import type { LocalDate, Product, Slot } from '../../db/types.ts'
import { choiceFromProduct, type FoodChoice } from '../../logic/addFood.ts'
import type { OffProduct } from '../../logic/off.ts'
import { rememberedFor } from '../../logic/pendingScan.ts'
import { emptyProductForm, productToForm, type ProductFormValues } from '../../logic/productForm.ts'
import { ProductForm } from '../lebensmittel/ProductForm.tsx'
import type { FoodResolver } from '../add/useFoodResolver.ts'
import Scanner from './Scanner.tsx'
import { LoadingCard, MissingSheet, OfflineSheet } from './ScanResult.tsx'

type State =
  | { kind: 'camera' }
  | { kind: 'loading'; code: string }
  /** off = bei OFF ohne kcal (Daten zum Vorbefüllen); null = gar nicht bei OFF */
  | { kind: 'missing'; code: string; off: OffProduct | null }
  | { kind: 'offline'; code: string; reason: 'offline' | 'unreachable'; scanId: string; openScans: number }
  | { kind: 'form'; code: string; initial: ProductFormValues; back: State }

type Props = {
  slot: Slot | undefined
  /** Tag, für den eingetragen wird */
  date: LocalDate
  today: LocalDate
  resolver: FoodResolver
  /** Treffer: zum Mengen-Schritt */
  onPick: (food: FoodChoice) => void
  onQuick: () => void
  /** Scanner schließen, zurück zur Suche */
  onClose: () => void
  /** „Später“: ganzes Sheet schließen (Prototyp führt zurück zum Tagebuch) */
  onLater: () => void
}

export default function ScanFlow({ slot, date, today, resolver, onPick, onQuick, onClose, onLater }: Props) {
  const toast = useToast()
  const [state, setState] = useState<State>({ kind: 'camera' })
  // Antworten einer abgebrochenen Abfrage (Scanner zu, neuer Scan) verwerfen
  const request = useRef(0)

  const choice = (product: Product) => resolver.resolve(`product:${product.id}`) ?? choiceFromProduct(product)

  const detect = async (code: string) => {
    const id = ++request.current
    setState({ kind: 'loading', code })
    try {
      const result = await lookupBarcode(code)
      if (id !== request.current) return
      switch (result.kind) {
        case 'local':
        case 'fetched':
          // Direkt zur Menge, ohne Trefferkarte (Jan, 21.10.2026)
          return onPick(choice(result.product))
        case 'notFound':
          return setState({ kind: 'missing', code, off: null })
        case 'noNutrients':
          return setState({ kind: 'missing', code, off: result.data })
        case 'offline':
        case 'unreachable': {
          const scan = await addPendingScan(code, slot?.id ?? null, date)
          const openScans = (await getPendingScans()).length
          if (id !== request.current) return
          return setState({ kind: 'offline', code, reason: result.kind, scanId: scan.id, openScans })
        }
      }
    } catch (error) {
      console.error(error)
      toast('Das hat nicht geklappt')
      if (id === request.current) setState({ kind: 'camera' })
    }
  }

  const close = () => {
    request.current++
    onClose()
  }

  if (state.kind === 'form') {
    return (
      <div className="bg-bg absolute inset-0 z-10 flex flex-col">
        <ProductForm
          initial={state.initial}
          onBack={() => setState(state.back)}
          onSaved={(product) => onPick(choiceFromProduct(product))}
        />
      </div>
    )
  }

  const create = (code: string, off: OffProduct | null) => {
    const initial = off ? productToForm({ ...off, barcode: code }) : { ...emptyProductForm(), barcode: code }
    setState({ kind: 'form', code, initial, back: state })
  }

  return (
    <Scanner
      onDetected={(code) => void detect(code)}
      onClose={close}
      paused={state.kind !== 'camera'}
      sheet={
        state.kind === 'missing' ? (
          <MissingSheet
            code={state.code}
            noNutrients={state.off !== null}
            onCreate={() => create(state.code, state.off)}
            onSearchLocal={close}
            onRescan={() => setState({ kind: 'camera' })}
          />
        ) : state.kind === 'offline' ? (
          <OfflineSheet
            reason={state.reason}
            rememberedFor={rememberedFor(slot?.name ?? null, date, today)}
            openScans={state.openScans}
            onManual={() => {
              // Mit Jan abgestimmt: manuell eingetragen = Scan erledigt, damit nichts doppelt kommt
              void resolvePendingScan(state.scanId)
              onQuick()
            }}
            onLater={onLater}
          />
        ) : undefined
      }
    >
      {state.kind === 'loading' && <LoadingCard code={state.code} />}
    </Scanner>
  )
}
