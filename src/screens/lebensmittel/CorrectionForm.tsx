// „Werte bearbeiten“ bei OFF-Produkten und BLS-Lebensmitteln (Korrekturschicht). Kein Prototyp:
// Nährwert-Karte wie im Produktformular, startet mit „Meine Werte“; gespeichert werden nur Abweichungen
// vom Original, das Original bleibt unverändert.
import { useState } from 'react'
import { href, navigate } from '../../app/router.ts'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { SubScreen, SubScreenTitle } from '../../components/ui/SubScreen.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { useBls } from '../../data/bls.ts'
import { useLiveQuery } from '../../db/live.ts'
import { NUTRIENT_KEYS } from '../../db/records.ts'
import type { FoodRef, Nutrients, Product, ProductOverride, Unit } from '../../db/types.ts'
import { getOverride, saveCorrection, setVerified } from '../../db/verify.ts'
import { formatNutrient } from '../../logic/nutrientInfo.ts'
import { fieldId, nutrientsToForm, parseDecimal, validateCorrectionForm, type FormErrors } from '../../logic/productForm.ts'
import { canVerify, effectiveUnit, mergeNutrients } from '../../logic/verify.ts'
import { NutrientInput } from './NutrientInput.tsx'

/** null = keine Korrektur, undefined = lädt */
const useCorrection = (ref: FoodRef) => useLiveQuery(async () => (await getOverride(ref)) ?? null, [ref])

export function ProductCorrection({ product }: { product: Product }) {
  const ref: FoodRef = `product:${product.id}`
  const override = useCorrection(ref)
  const back = href('lebensmittel', 'produkt', product.id)
  if (override === undefined) return <SubScreen back={back} />
  return (
    <CorrectionForm
      foodRef={ref}
      name={product.name}
      unit={effectiveUnit(product.unit, override ?? undefined)}
      original={product.per100}
      override={override ?? undefined}
      back={back}
    />
  )
}

export function BlsCorrection({ code }: { code: string }) {
  const bls = useBls()
  const ref: FoodRef = `bls:${code}`
  const override = useCorrection(ref)
  const back = href('lebensmittel', 'bls', code)
  if (bls.status === 'loading' || override === undefined) return <SubScreen back={back} />
  const food = bls.status === 'ready' ? bls.data.byCode.get(code) : undefined
  if (!food) {
    return (
      <SubScreen back={back}>
        <SubScreenTitle title="Nicht gefunden" meta={`BLS-Code ${code} gibt es nicht.`} />
      </SubScreen>
    )
  }
  return (
    <CorrectionForm
      foodRef={ref}
      name={food.name}
      unit={effectiveUnit('g', override ?? undefined)}
      original={food.per100}
      override={override ?? undefined}
      back={back}
    />
  )
}

type Props = {
  foodRef: FoodRef
  name: string
  unit: Unit
  original: Nutrients
  override: ProductOverride | undefined
  back: string | (() => void)
  /** Statt zurückzuspringen (Prüf-Dialog) */
  onSaved?: () => void
  /** Prüf-Dialog: Werte kommen vom Etikett, also gleich als geprüft markieren (wenn alle Pflichtangaben da sind) */
  verifyOnSave?: boolean
}

export function CorrectionForm({ foodRef, name, unit, original, override, back, onSaved, verifyOnSave = false }: Props) {
  const toast = useToast()
  // Startwerte nur einmal übernehmen; spätere Datenbank-Änderungen überschreiben die Eingaben nicht
  const [values, setValues] = useState(() => nutrientsToForm(mergeNutrients(original, override)))
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const result = validateCorrectionForm(values)
    if (!result.ok) {
      setErrors(result.errors)
      document.getElementById(fieldId(Object.keys(result.errors)[0] ?? ''))?.focus()
      return
    }
    setSaving(true)
    try {
      await saveCorrection(foodRef, original, result.per100)
      if (verifyOnSave && canVerify(result.per100)) await setVerified(foodRef, original, true)
      toast('Gespeichert')
      if (onSaved) onSaved()
      else if (typeof back === 'string') navigate(back, { replace: true })
      else back()
    } catch (error) {
      console.error(error)
      toast('Speichern fehlgeschlagen')
      setSaving(false)
    }
  }

  return (
    <SubScreen back={back}>
      <form
        noValidate
        className="gap-card-gap flex flex-col"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <SubScreenTitle title="Werte bearbeiten" meta={name} />

        <Card padded={false} className="px-card-padding pt-3.5 pb-1">
          <h2 className="text-body pb-1 font-semibold">Meine Werte pro 100 {unit}</h2>
          {NUTRIENT_KEYS.map((key) => {
            const parsed = parseDecimal(values[key])
            const differs = parsed !== 'invalid' && parsed !== original[key]
            return (
              <NutrientInput
                key={key}
                nutrient={key}
                value={values[key]}
                error={errors[key]}
                hint={differs ? `Original ${formatNutrient(key, original[key])}` : undefined}
                onChange={(v) => setValues((s) => ({ ...s, [key]: v }))}
              />
            )
          })}
        </Card>
        <p className="text-small text-muted px-1 leading-[1.45]">
          Trag die Werte vom Etikett ein. Leere Felder gelten als unbekannt, nicht als 0. Das Original bleibt unverändert;
          gespeichert wird nur, was davon abweicht.
        </p>

        <Button type="submit" disabled={saving} className="w-full">
          Sichern
        </Button>
      </form>
    </SubScreen>
  )
}
