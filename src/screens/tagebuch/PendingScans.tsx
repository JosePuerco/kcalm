// Gemerkte Scans (kein Prototyp, mit Jan abgestimmt): Zeile „2 gemerkte Scans“ über den Slots; Tipp öffnet
// die Liste. Jeder Scan führt zur Menge im gemerkten Slot und Tag, bei „nicht gefunden“ / „ohne Nährwerte“
// zum vorbefüllten Produktformular. Wischen verwirft einen Scan.
import { useEffect, useState } from 'react'
import { openScanSheet, setDiaryDate } from '../../app/diaryState.ts'
import { runPendingSync, usePendingSync } from '../../app/pendingSync.ts'
import { IconChevronRight } from '../../components/icons/icons.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { Sheet } from '../../components/ui/Sheet.tsx'
import { SwipeRow } from '../../components/ui/SwipeRow.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { resolvePendingScan, type PendingItem } from '../../db/pendingScans.ts'
import type { LocalDate, Slot } from '../../db/types.ts'
import { choiceFromProduct, per100Label } from '../../logic/addFood.ts'
import { formatEan } from '../../logic/barcode.ts'
import { PENDING_STATUS_TEXT, pendingCountLabel, pendingStatus, rememberedFor } from '../../logic/pendingScan.ts'
import { emptyProductForm, productToForm } from '../../logic/productForm.ts'

export function PendingScansRow({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="press w-full text-left">
      <Card padded={false} className="flex min-h-[60px] items-center gap-2.5 px-4 py-2">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-body font-semibold">{pendingCountLabel(count)}</span>
          <span className="text-small text-muted">Produkt nachladen und eintragen</span>
        </span>
        <IconChevronRight className="text-muted shrink-0" />
      </Card>
    </button>
  )
}

type SheetProps = {
  open: boolean
  onClose: () => void
  items: PendingItem[]
  slots: Slot[]
  today: LocalDate
}

export function PendingScansSheet({ open, onClose, items, slots, today }: SheetProps) {
  const toast = useToast()
  const sync = usePendingSync()
  const [swipedId, setSwipedId] = useState<string | null>(null)

  // Beim Öffnen nachladen, was noch fehlt (z. B. wenn OFF vorhin nicht antwortete)
  useEffect(() => {
    if (open) void runPendingSync()
  }, [open])
  // Alle erledigt: Liste schließen
  useEffect(() => {
    if (open && items.length === 0) onClose()
  }, [open, items.length, onClose])

  const start = (item: PendingItem) => {
    const { scan, product } = item
    const outcome = sync.outcomes.get(scan.barcode)
    if (!product && !outcome) {
      toast(navigator.onLine ? 'Wird noch geladen …' : 'Kein Internet – Kcalm lädt es, sobald du online bist')
      return
    }
    onClose()
    if (scan.date) setDiaryDate(scan.date, today)
    if (product) return openScanSheet(scan.slotId, { scanId: scan.id, food: choiceFromProduct(product) })
    const create =
      outcome?.kind === 'noNutrients'
        ? productToForm({ ...outcome.data, barcode: scan.barcode })
        : { ...emptyProductForm(), barcode: scan.barcode }
    openScanSheet(scan.slotId, { scanId: scan.id, create })
  }

  const discard = async (item: PendingItem) => {
    setSwipedId(null)
    try {
      await resolvePendingScan(item.scan.id)
      toast('Scan verworfen')
    } catch (error) {
      console.error(error)
      toast('Das hat nicht geklappt')
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Gemerkte Scans">
      <div className="scroll-area px-screen-x pb-[calc(24px+env(safe-area-inset-bottom))]">
        <Card padded={false} className="[&>*:first-child]:border-t-0">
          {items.map((item) => {
            const { scan, product } = item
            const status = pendingStatus(!!product, sync.outcomes.get(scan.barcode)?.kind, sync.running)
            const slotName = slots.find((s) => s.id === scan.slotId)?.name ?? null
            const title = product?.name ?? `EAN ${formatEan(scan.barcode)}`
            const detail =
              status === 'ready' ? (product ? per100Label(choiceFromProduct(product)) : '') : PENDING_STATUS_TEXT[status]
            const when = scan.date ? rememberedFor(slotName, scan.date, today) : (slotName ?? '')
            return (
              <SwipeRow
                key={scan.id}
                swiped={swipedId === scan.id}
                anySwiped={swipedId !== null}
                onSwipe={(isOpen) => setSwipedId(isOpen ? scan.id : null)}
                onTap={() => start(item)}
                onAction={() => void discard(item)}
                actionLabel="Verwerfen"
                label={`${title}, ${when}, ${detail}`}
              >
                <div className="flex min-h-14 items-center gap-2.5 px-3.5 py-2">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-body font-medium break-words">{title}</span>
                    <span className="text-small text-muted">
                      {when} · {detail}
                    </span>
                  </span>
                  <IconChevronRight className="text-muted shrink-0" />
                </div>
              </SwipeRow>
            )
          })}
        </Card>
        <p className="text-small text-muted px-1 pt-2 leading-[1.45]">Nach links wischen verwirft einen Scan.</p>
      </div>
    </Sheet>
  )
}
