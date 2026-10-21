// Profilfelder nach Start.dc.html: Name, Wochenbudget mit „= 2.800 / Tag“, Makros mit Modus-Chip
// je Zeile und Ergebnis „≈ 133 g“, Körpergewicht für g/kg. Auch für Profile und Ziele (Profil.dc.html).
// Zahlen über die iPhone-Zifferntastatur wie im Produktformular (inputMode decimal).
import { IconInfo } from '../../components/icons/icons.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { Segmented } from '../../components/ui/Segmented.tsx'
import { formatNumber } from '../../logic/format.ts'
import { MACRO_KEYS, type MacroKey } from '../../logic/goals.ts'
import {
  MACRO_PRESETS,
  MODE_LABEL,
  changeMode,
  nextMode,
  presetFor,
  presetMacros,
  profileFieldId,
  profilePreview,
  type ProfileErrors,
  type ProfileFormValues,
} from '../../logic/profileForm.ts'

const MACRO_LABEL: Record<MacroKey, string> = { protein: 'Eiweiß', fat: 'Fett', carbs: 'Kohlenhydrate' }
// Reihenfolge wie im Prototyp
const ROWS: readonly MacroKey[] = ['protein', 'fat', 'carbs']


type Props = {
  values: ProfileFormValues
  errors: ProfileErrors
  onChange: (values: ProfileFormValues) => void
}

export function ProfileFields({ values, errors, onChange }: Props) {
  const preview = profilePreview(values)
  const set = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) =>
    onChange({ ...values, [key]: value })
  const setMacroValue = (key: MacroKey, value: string) =>
    onChange({ ...values, macros: { ...values.macros, [key]: { ...values.macros[key], value } } })

  return (
    <>
      <Card padded={false} className="px-card-padding py-1">
        <label className="text-body flex min-h-[50px] items-center justify-between gap-3">
          Name
          <input
            id={profileFieldId('name')}
            value={values.name}
            placeholder="z. B. Aufbau"
            autoComplete="off"
            enterKeyHint="next"
            aria-invalid={errors.name ? true : undefined}
            onChange={(e) => set('name', e.target.value)}
            className="text-body-large text-text placeholder:text-muted min-h-touch-min w-40 min-w-0 bg-transparent text-right font-semibold outline-none"
          />
        </label>
        <FieldError text={errors.name} />
      </Card>

      <Card>
        <label htmlFor={profileFieldId('weeklyKcal')} className="text-secondary text-muted">
          Wochenbudget
        </label>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-baseline">
            <input
              id={profileFieldId('weeklyKcal')}
              inputMode="numeric"
              value={values.weeklyKcal}
              placeholder="19600"
              aria-invalid={errors.weeklyKcal ? true : undefined}
              onChange={(e) => set('weeklyKcal', e.target.value)}
              className="text-ring text-text placeholder:text-chevron-muted w-[5.2ch] min-w-0 bg-transparent outline-none"
            />
            <span className="text-body-large text-muted font-medium"> kcal</span>
          </span>
          <span className="text-label text-muted whitespace-nowrap">
            = {preview.daily === null ? '–' : formatNumber(preview.daily)} / Tag
          </span>
        </div>
        <FieldError text={errors.weeklyKcal} />
      </Card>

      <Card className="pb-1.5">
        <span className="text-body font-semibold">Makros pro Tag</span>
        <div className="mt-2.5 mb-1.5">
          <Segmented
            inCard
            label="Vorlage für Makros"
            options={MACRO_PRESETS}
            value={presetFor(values.macros)}
            onChange={(preset) => set('macros', presetMacros(preset))}
          />
        </div>
        {ROWS.map((key) => (
          <MacroRow
            key={key}
            label={MACRO_LABEL[key]}
            mode={MODE_LABEL[values.macros[key].mode]}
            onMode={() => onChange(changeMode(values, key, nextMode(key, values.macros[key].mode)))}
            value={values.macros[key].mode === 'rest' ? null : values.macros[key].value}
            onValue={(v) => setMacroValue(key, v)}
            id={profileFieldId(key)}
            result={preview.grams[key] === null ? '' : `≈ ${formatNumber(preview.grams[key])} g`}
            error={errors[key]}
          />
        ))}
        <MacroRow
          label="Ballaststoffe"
          mode="g"
          value={values.fiberG}
          onValue={(v) => set('fiberG', v)}
          id={profileFieldId('fiberG')}
          result={values.fiberG.trim() === '' ? '' : `${values.fiberG.trim()} g`}
          error={errors.fiberG}
        />
        <FieldError text={errors.macros} />
        {preview.restNegative && !errors.macros && (
          <p className="text-small text-warn-text pb-2">Die anderen Makros brauchen schon das ganze Tagesziel.</p>
        )}
      </Card>

      <Card padded={false} className="flex flex-col px-4 py-3">
        <div className="flex items-center gap-3">
          <IconInfo className="text-muted shrink-0" />
          <label htmlFor={profileFieldId('weightKg')} className="text-secondary text-muted flex-1 leading-[1.4]">
            {MACRO_KEYS.some((k) => values.macros[k].mode === 'gPerKg')
              ? 'Eiweiß in g/kg nutzt dein Körpergewicht. Ohne Verbrauchsschätzung trägst du es hier ein.'
              : 'Körpergewicht für g/kg (optional).'}
          </label>
          <span className="flex items-baseline">
            <input
              id={profileFieldId('weightKg')}
              inputMode="decimal"
              value={values.weightKg}
              placeholder="74,0"
              aria-invalid={errors.weightKg ? true : undefined}
              onChange={(e) => set('weightKg', e.target.value)}
              className="text-body-large text-text placeholder:text-muted min-h-touch-min w-14 bg-transparent text-right font-semibold outline-none"
            />
            <span className="text-body-large font-semibold"> kg</span>
          </span>
        </div>
        <FieldError text={errors.weightKg} />
      </Card>
    </>
  )
}

type RowProps = {
  label: string
  mode: string
  /** Tipp auf den Chip wechselt den Modus; fehlt = fester Modus */
  onMode?: () => void
  /** null bei „Rest“: kein Eingabefeld */
  value: string | null
  onValue: (value: string) => void
  id: string
  result: string
  error?: string
}

function MacroRow({ label, mode, onMode, value, onValue, id, result, error }: RowProps) {
  const chip = 'text-small text-muted bg-segment-track-in-card rounded-[8px] px-2 py-1'
  return (
    <div className="border-line border-t">
      <div className="flex min-h-[52px] items-center gap-2.5">
        <label htmlFor={id} className="text-body flex-1">
          {label}
        </label>
        {onMode ? (
          // Chip ist klein gezeichnet, das Touch-Ziel bleibt 44 px
          <button
            type="button"
            onClick={onMode}
            aria-label={`${label}: Modus ${mode}, tippen zum Wechseln`}
            className="press min-h-touch-min flex items-center"
          >
            <span className={chip}>{mode}</span>
          </button>
        ) : (
          <span className={chip}>{mode}</span>
        )}
        {value === null ? (
          <span className="text-body w-[46px] text-right font-semibold">–</span>
        ) : (
          <input
            id={id}
            inputMode="decimal"
            value={value}
            aria-invalid={error ? true : undefined}
            onChange={(e) => onValue(e.target.value)}
            className="text-body-large text-text min-h-touch-min w-[46px] bg-transparent text-right font-semibold outline-none"
          />
        )}
        <span className="text-secondary text-muted min-w-14 text-right">{result}</span>
      </div>
      <FieldError text={error} />
    </div>
  )
}

function FieldError({ text }: { text?: string }) {
  if (!text) return null
  return <p className="text-small text-danger pb-2">{text}</p>
}
