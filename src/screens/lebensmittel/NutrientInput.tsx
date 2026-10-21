// Eingabezeile für einen Nährwert (Produktformular und Korrektur): Name, Zahl mit Komma, Einheit.
import type { NutrientKey } from '../../db/types.ts'
import { NUTRIENT_INFO, REQUIRED_NUTRIENTS } from '../../logic/nutrientInfo.ts'
import { fieldId } from '../../logic/productForm.ts'

type NutrientInputProps = {
  nutrient: NutrientKey
  value: string
  error?: string
  /** Zeile unter dem Feld, z. B. „Original 4 g“ in der Korrektur */
  hint?: string
  onChange: (value: string) => void
}

export function NutrientInput({ nutrient, value, error, hint, onChange }: NutrientInputProps) {
  const info = NUTRIENT_INFO[nutrient]
  // Pflicht ist fast alles; markiert werden daher die optionalen Felder
  const required = REQUIRED_NUTRIENTS.includes(nutrient)
  return (
    <div className="border-line border-t">
      <label className="text-label flex min-h-touch-min items-center gap-2">
        <span className={`flex-1 ${info.sub ? 'text-muted pl-3' : ''}`}>
          {info.label}
          {!required && <span className="text-muted"> (optional)</span>}
        </span>
        <input
          id={fieldId(nutrient)}
          inputMode="decimal"
          required={required}
          placeholder={required ? '' : '–'}
          value={value}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          className="text-body-large placeholder:text-muted min-h-touch-min w-20 bg-transparent text-right outline-none"
        />
        <span className="text-muted w-8">{info.unit}</span>
      </label>
      {error ? (
        <span className="text-small text-danger block pb-1.5 text-right">{error}</span>
      ) : (
        hint && <span className="text-small text-muted block pb-1.5 text-right">{hint}</span>
      )}
    </div>
  )
}
