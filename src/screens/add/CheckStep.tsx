// Prüf-Dialog vor dem Mengen-Schritt (PLAN.md Phase 6): ungeprüftes OFF-Produkt einmal mit dem Etikett
// vergleichen. „Stimmt so“ = geprüft, „Werte korrigieren“ = Korrekturschicht, „Später prüfen“ fragt beim
// nächsten Mal wieder. Danach direkt zur Menge. Kein Prototyp: Kopf wie der Mengen-Schritt, Tabelle wie
// die Nährwert-Karte im Produktdetail. Darüber die Einheit g/ml, weil sie auch auf dem Etikett steht (Jan, 27.10.2026).
import { useEffect, useState } from 'react'
import { IconBack } from '../../components/icons/icons.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { Overlay } from '../../components/ui/overlay.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { db } from '../../db/db.ts'
import { useLiveQuery } from '../../db/live.ts'
import type { FoodRef } from '../../db/types.ts'
import { getOverride, setVerified } from '../../db/verify.ts'
import type { FoodChoice } from '../../logic/addFood.ts'
import { formatNutrient, MAIN_NUTRIENTS, NUTRIENT_INFO } from '../../logic/nutrientInfo.ts'
import { canVerify, effectiveUnit, mergeNutrients, missingForVerify } from '../../logic/verify.ts'
import { CorrectionForm } from '../lebensmittel/CorrectionForm.tsx'
import { UnitCard } from '../lebensmittel/UnitCard.tsx'

type Props = {
  food: FoodChoice
  onBack: () => void
  /** Weiter zur Menge */
  onDone: () => void
}

export function CheckStep({ food, onBack, onDone }: Props) {
  const toast = useToast()
  const ref = food.ref as FoodRef
  const id = ref.slice('product:'.length)
  const data = useLiveQuery(async () => {
    const [product, override] = await Promise.all([db.products.get(id), getOverride(ref)])
    return { product, override }
  }, [id, ref])
  const [correcting, setCorrecting] = useState(false)
  const [busy, setBusy] = useState(false)
  // Produkt fehlt (sollte nicht vorkommen): ohne Prüfung weiter
  const missingProduct = data !== undefined && !data.product
  useEffect(() => {
    if (missingProduct) onDone()
  }, [missingProduct, onDone])

  if (!data?.product) return null
  const { product, override } = data
  const mine = mergeNutrients(product.per100, override)
  const unit = effectiveUnit(product.unit, override)
  const missing = missingForVerify(mine)

  const confirm = async () => {
    setBusy(true)
    try {
      await setVerified(ref, product.per100, true)
      onDone()
    } catch (error) {
      console.error(error)
      toast('Das hat nicht geklappt')
      setBusy(false)
    }
  }

  return (
    <div className="px-screen-x flex min-h-0 flex-1 flex-col pb-[calc(16px+env(safe-area-inset-bottom))]">
      <div className="-ml-2.5 flex items-center gap-1">
        <button type="button" aria-label="Zurück" onClick={onBack} className="press flex size-11 shrink-0 items-center justify-center">
          <IconBack />
        </button>
        <span className="flex min-w-0 flex-col">
          <span className="text-sheet-title truncate">{food.name}</span>
          <span className="text-small text-muted">{food.source} · Nicht geprüft</span>
        </span>
      </div>

      <div className="scroll-area gap-card-gap flex flex-col pt-2.5 pb-3">
        <p className="text-label text-muted px-1 leading-[1.45]">
          Stimmen die Werte mit dem Etikett überein? Einmal prüfen reicht.
        </p>
        <UnitCard foodRef={ref} original={product.unit} unit={unit} />
        <Card className="pt-3.5 pb-1.5">
          <h2 className="text-body pb-2 font-semibold">Nährwerte pro 100 {unit}</h2>
          {MAIN_NUTRIENTS.map((key) => {
            const info = NUTRIENT_INFO[key]
            return (
              <div key={key} className="border-line text-label flex min-h-10 items-center border-t">
                <span className={`flex-1 ${info.sub ? 'text-muted pl-3' : ''}`}>{info.label}</span>
                <span className="pr-2 text-right">{formatNutrient(key, mine[key])}</span>
              </div>
            )
          })}
          <p className="text-small text-muted py-2 leading-[1.4]">„–“ heißt unbekannt, nicht 0.</p>
        </Card>
        {missing.length > 0 && (
          <p className="text-small text-muted px-1 leading-[1.45]">
            Zum Prüfen fehlt noch: {missing.map((k) => NUTRIENT_INFO[k].label).join(', ')}. Trag die Werte über
            „Werte korrigieren“ ein.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Button disabled={busy || !canVerify(mine)} onClick={() => void confirm()}>
          Stimmt so
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => setCorrecting(true)}>
          Werte korrigieren
        </Button>
        <Button variant="text" className="justify-center" disabled={busy} onClick={onDone}>
          Später prüfen
        </Button>
      </div>

      {correcting && (
        <Overlay>
          <div className="bg-bg absolute inset-0 z-10 flex flex-col">
            <CorrectionForm
              foodRef={ref}
              name={product.name}
              unit={unit}
              original={product.per100}
              override={override}
              back={() => setCorrecting(false)}
              onSaved={onDone}
            />
          </div>
        </Overlay>
      )}
    </div>
  )
}
