// Produkt anlegen/bearbeiten. Kein Prototyp: eigener Screen im Stil von Produkt.dc.html
// (mit Jan abgestimmt). Zahlen über die iPhone-Zifferntastatur mit Komma (inputMode decimal).
import { useState } from 'react'
import { href, navigate } from '../../app/router.ts'
import { IconClose } from '../../components/icons/icons.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { Segmented } from '../../components/ui/Segmented.tsx'
import { SubScreen, SubScreenTitle } from '../../components/ui/SubScreen.tsx'
import { TextField } from '../../components/ui/TextField.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { db } from '../../db/db.ts'
import { useLiveQuery } from '../../db/live.ts'
import { createProduct, updateProduct } from '../../db/products.ts'
import type { NutrientKey, Product, Unit } from '../../db/types.ts'
import { MAIN_NUTRIENTS } from '../../logic/nutrientInfo.ts'
import {
  emptyProductForm,
  fieldId,
  productToForm,
  validateProductForm,
  type FormErrors,
  type ProductFormValues,
} from '../../logic/productForm.ts'
import { ProductCorrection } from './CorrectionForm.tsx'
import { NutrientInput } from './NutrientInput.tsx'

const UNITS = [
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
] as const

type Props = {
  /** fehlt = neues Produkt */
  id?: string
  /** Startwerte für ein neues Produkt, z. B. Barcode aus dem Scanner */
  initial?: ProductFormValues
  /** Statt zur Produktseite zu springen (Formular über dem Scanner) */
  onSaved?: (product: Product) => void
  onBack?: () => void
}

export function ProductForm({ id, initial, onSaved, onBack }: Props) {
  const existing = useLiveQuery(async () => {
    if (!id) return null
    const p = await db.products.get(id)
    return p && p.deletedAt === null ? p : null
  }, [id])
  const back = onBack ?? (id ? href('lebensmittel', 'produkt', id) : href('lebensmittel'))

  if (id && existing === undefined) return <SubScreen back={back} />
  if (id && !existing) {
    return (
      <SubScreen back={href('lebensmittel')}>
        <SubScreenTitle title="Nicht gefunden" meta="Dieses Produkt gibt es nicht mehr." />
      </SubScreen>
    )
  }
  // OFF-Original nie überschreiben (CLAUDE.md): eigene Werte gehen in die Korrekturschicht
  if (existing?.source === 'off') return <ProductCorrection product={existing} />
  // Startwerte nur einmal übernehmen; spätere Datenbank-Änderungen überschreiben die Eingaben nicht
  return (
    <FormBody
      key={id ?? 'neu'}
      id={id}
      back={back}
      initial={existing ? productToForm(existing) : (initial ?? emptyProductForm())}
      onSaved={onSaved}
    />
  )
}

type BodyProps = {
  id?: string
  back: string | (() => void)
  initial: ProductFormValues
  onSaved?: (product: Product) => void
}

function FormBody({ id, back, initial, onSaved }: BodyProps) {
  const toast = useToast()
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }))
  const setNutrient = (key: NutrientKey, value: string) =>
    setValues((v) => ({ ...v, nutrients: { ...v.nutrients, [key]: value } }))
  const setPortion = (index: number, field: 'label' | 'amount', value: string) =>
    setValues((v) => ({ ...v, portions: v.portions.map((p, i) => (i === index ? { ...p, [field]: value } : p)) }))

  const submit = async () => {
    const result = validateProductForm(values)
    if (!result.ok) {
      setErrors(result.errors)
      const keys = Object.keys(result.errors)
      // Zum ersten Fehler springen (nach dem Rendern)
      requestAnimationFrame(() => document.getElementById(fieldId(keys[0] ?? ''))?.focus())
      return
    }
    setSaving(true)
    try {
      const saved = id ? await updateProduct(id, result.data) : await createProduct(result.data)
      toast('Gespeichert')
      if (onSaved) onSaved(saved)
      else navigate(href('lebensmittel', 'produkt', saved.id), { replace: true })
    } catch (error) {
      console.error(error)
      toast('Speichern fehlgeschlagen')
      setSaving(false)
    }
  }

  const nutrientRows = (keys: readonly NutrientKey[]) =>
    keys.map((key) => (
      <NutrientInput
        key={key}
        nutrient={key}
        value={values.nutrients[key]}
        error={errors[key]}
        onChange={(v) => setNutrient(key, v)}
      />
    ))

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
        <SubScreenTitle title={id ? 'Produkt bearbeiten' : 'Neues Produkt'} />

        <Card padded={false} className="px-card-padding py-1">
          <TextField
            id={fieldId('name')}
            label="Name"
            placeholder="z. B. Skyr natur"
            value={values.name}
            error={errors.name}
            onChange={(e) => set('name', e.target.value)}
            autoComplete="off"
            enterKeyHint="next"
          />
          <div className="border-line border-t">
            <TextField
              id={fieldId('brand')}
              label="Marke (optional)"
              value={values.brand}
              error={errors.brand}
              onChange={(e) => set('brand', e.target.value)}
              autoComplete="off"
              enterKeyHint="next"
            />
          </div>
          <div className="border-line border-t">
            <TextField
              id={fieldId('barcode')}
              label="Barcode (optional)"
              inputMode="numeric"
              value={values.barcode}
              error={errors.barcode}
              onChange={(e) => set('barcode', e.target.value)}
              autoComplete="off"
              enterKeyHint="next"
            />
          </div>
          <div className="border-line text-label flex min-h-14 items-center justify-between gap-3 border-t">
            <span>Einheit</span>
            <div className="w-32">
              <Segmented label="Einheit" inCard options={UNITS} value={values.unit} onChange={(u: Unit) => set('unit', u)} />
            </div>
          </div>
        </Card>

        <Card padded={false} className="px-card-padding pt-3.5 pb-1">
          <h2 className="text-body pb-1 font-semibold">Nährwerte pro 100 {values.unit}</h2>
          {nutrientRows(MAIN_NUTRIENTS)}
        </Card>
        <p className="text-small text-muted px-1 leading-[1.45]">
          Pflicht sind der Name und alle Werte der Nährwerttabelle vom Etikett. Leere optionale Felder gelten als
          unbekannt, nicht als 0.
        </p>

        <Card padded={false} className="px-card-padding py-1">
          <div className="flex min-h-12 items-center justify-between">
            <h2 className="text-body font-semibold">Portionen</h2>
            <Button
              variant="text"
              className="text-label -mr-2.5"
              onClick={() => set('portions', [...values.portions, { label: '', amount: '' }])}
            >
              Hinzufügen
            </Button>
          </div>
          {values.portions.length === 0 && (
            <p className="border-line text-label text-muted flex min-h-touch-min items-center border-t">
              Noch keine Portionen
            </p>
          )}
          {values.portions.map((p, i) => {
            const labelError = errors[`portions.${i}.label`]
            const amountError = errors[`portions.${i}.amount`]
            return (
              <div key={i} className="border-line border-t py-1">
                <div className="flex items-center gap-2">
                  <input
                    id={fieldId(`portions.${i}.label`)}
                    aria-label={`Portion ${i + 1}: Bezeichnung`}
                    aria-invalid={labelError ? true : undefined}
                    placeholder="z. B. 1 Becher"
                    value={p.label}
                    onChange={(e) => setPortion(i, 'label', e.target.value)}
                    autoComplete="off"
                    className="text-body-large placeholder:text-muted min-h-touch-min min-w-0 flex-1 bg-transparent outline-none"
                  />
                  <input
                    id={fieldId(`portions.${i}.amount`)}
                    aria-label={`Portion ${i + 1}: Menge in ${values.unit}`}
                    aria-invalid={amountError ? true : undefined}
                    inputMode="decimal"
                    placeholder="0"
                    value={p.amount}
                    onChange={(e) => setPortion(i, 'amount', e.target.value)}
                    autoComplete="off"
                    className="text-body-large placeholder:text-muted min-h-touch-min w-16 bg-transparent text-right outline-none"
                  />
                  <span className="text-label text-muted w-6">{values.unit}</span>
                  <button
                    type="button"
                    aria-label={`Portion ${i + 1} entfernen`}
                    onClick={() => set('portions', values.portions.filter((_, j) => j !== i))}
                    className="press text-muted -mr-2.5 flex size-11 items-center justify-center"
                  >
                    <IconClose />
                  </button>
                </div>
                {(labelError || amountError) && (
                  <span className="text-small text-danger block pb-1">{[labelError, amountError].filter(Boolean).join(' · ')}</span>
                )}
              </div>
            )
          })}
        </Card>

        <Button type="submit" disabled={saving} className="w-full">
          Sichern
        </Button>
      </form>
    </SubScreen>
  )
}
