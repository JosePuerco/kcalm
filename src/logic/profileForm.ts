// Profilformular (Ersteinrichtung Schritt 2, Profile und Ziele): Eingabetexte → geprüfte Profilwerte.
// Zahlen als Text mit Dezimalkomma; gerechnet wird mit goals.ts.

import type { MacroMode, MacroTarget, ProfileVersion } from '../db/types.ts'
import { formatNumber } from './format.ts'
import { GPERKG_MACROS, KCAL_PER_GRAM, MACRO_KEYS, fixedDailyTarget, macroGoals, type MacroKey } from './goals.ts'
import { parseDecimal, toInput } from './productForm.ts'

export interface MacroInput {
  mode: MacroMode
  /** leer bei „Rest“ */
  value: string
}

export interface ProfileFormValues {
  name: string
  weeklyKcal: string
  macros: Record<MacroKey, MacroInput>
  fiberG: string
  /** Körpergewicht für g/kg (bis zur Verbrauchsschätzung in Phase 9 immer manuell) */
  weightKg: string
}

export type ProfileFormData = Pick<
  ProfileVersion,
  'weeklyKcal' | 'protein' | 'fat' | 'carbs' | 'fiberG' | 'manualWeightKg'
> & { name: string }

export type MacroPreset = 'grams' | 'percent' | 'mixed'

export const MACRO_PRESETS: readonly { value: MacroPreset; label: string }[] = [
  { value: 'grams', label: 'Gramm' },
  { value: 'percent', label: 'Prozent' },
  { value: 'mixed', label: 'Gemischt' },
]

/** Startwerte je Vorlage (Start.dc.html: „Gemischt“ = 1,8 g/kg · 25 % · Rest) */
const PRESET_MACROS: Record<MacroPreset, Record<MacroKey, MacroInput>> = {
  grams: { protein: { mode: 'g', value: '140' }, fat: { mode: 'g', value: '80' }, carbs: { mode: 'g', value: '330' } },
  percent: {
    protein: { mode: 'percent', value: '20' },
    fat: { mode: 'percent', value: '30' },
    carbs: { mode: 'percent', value: '50' },
  },
  mixed: {
    protein: { mode: 'gPerKg', value: '1,8' },
    fat: { mode: 'percent', value: '25' },
    carbs: { mode: 'rest', value: '' },
  },
}

export function presetMacros(preset: MacroPreset): Record<MacroKey, MacroInput> {
  return structuredClone(PRESET_MACROS[preset])
}

/** Welche Vorlage passt zu den aktuellen Modi? null = eigene Mischung */
export function presetFor(macros: Record<MacroKey, MacroInput>): MacroPreset | null {
  const modes = (p: MacroPreset) => MACRO_KEYS.every((k) => PRESET_MACROS[p][k].mode === macros[k].mode)
  return MACRO_PRESETS.find((p) => modes(p.value))?.value ?? null
}

export function emptyProfileForm(): ProfileFormValues {
  return { name: '', weeklyKcal: '', macros: presetMacros('mixed'), fiberG: '30', weightKg: '' }
}

export function profileToForm(name: string, v: ProfileVersion): ProfileFormValues {
  const macro = (t: MacroTarget): MacroInput => ({ mode: t.mode, value: t.mode === 'rest' ? '' : toInput(t.value) })
  return {
    name,
    weeklyKcal: toInput(v.weeklyKcal),
    macros: { protein: macro(v.protein), fat: macro(v.fat), carbs: macro(v.carbs) },
    fiberG: toInput(v.fiberG),
    weightKg: toInput(v.manualWeightKg),
  }
}

/** Kurzform im Modus-Chip */
export const MODE_LABEL: Readonly<Record<MacroMode, string>> = { g: 'g', percent: '%', gPerKg: 'g/kg', rest: 'Rest' }

/** Tipp auf den Modus-Chip: g → % → g/kg → Rest → g; g/kg nur für Eiweiß und Fett */
export function nextMode(key: MacroKey, mode: MacroMode): MacroMode {
  const order: MacroMode[] = GPERKG_MACROS.includes(key) ? ['g', 'percent', 'gPerKg', 'rest'] : ['g', 'percent', 'rest']
  return order[(order.indexOf(mode) + 1) % order.length] ?? 'g'
}

/**
 * Wert für einen neuen Modus, so dass die Gramm gleich bleiben (gerundet: g und % ganzzahlig, g/kg eine Stelle).
 * Beispiel: Eiweiß 133,2 g bei 2.800 kcal → 19 %; bei 74 kg → 1,8 g/kg. Ohne Grundlage bleibt der alte Text.
 */
export function convertMacroValue(
  key: MacroKey,
  grams: number | null,
  mode: MacroMode,
  daily: number | null,
  weightKg: number | null,
  fallback: string,
): string {
  if (mode === 'rest') return ''
  if (grams === null) return fallback
  if (mode === 'g') return toInput(Math.round(grams))
  if (mode === 'percent') return daily ? toInput(Math.round(((grams * KCAL_PER_GRAM[key]) / daily) * 100)) : fallback
  return weightKg ? toInput(Math.round((grams / weightKg) * 10) / 10) : fallback
}

/**
 * Modus wechseln und den Wert umrechnen, damit die Gramm gleich bleiben. Wird ein Makro zu „Rest“,
 * wird ein bisheriger Rest zu Gramm mit seinem aktuellen Ergebnis, damit höchstens ein Rest bleibt.
 */
export function changeMode(values: ProfileFormValues, key: MacroKey, mode: MacroMode): ProfileFormValues {
  const preview = profilePreview(values)
  const weight = number(values.weightKg)
  const value = convertMacroValue(key, preview.grams[key], mode, preview.daily, weight, values.macros[key].value)
  const macros = { ...values.macros, [key]: { mode, value } }
  if (mode === 'rest') {
    for (const other of MACRO_KEYS) {
      if (other !== key && macros[other].mode === 'rest') {
        const grams = preview.grams[other]
        macros[other] = { mode: 'g', value: grams === null ? '' : toInput(Math.round(grams)) }
      }
    }
  }
  return { ...values, macros }
}

/** Tagesbudget eingetippt → Wochenbudget (× 7) für das Formular; ungültig = leer */
export function weeklyFromDaily(dailyText: string): string {
  const v = parseDecimal(dailyText)
  return typeof v === 'number' ? toInput(Math.round(v * 7 * 10) / 10) : ''
}

/** Tagesbudget fürs Eingabefeld aus dem Wochenbudget, ganzzahlig gerundet */
export function dailyFromWeekly(weeklyText: string): string {
  const v = parseDecimal(weeklyText)
  return typeof v === 'number' && v > 0 ? toInput(Math.round(fixedDailyTarget(v))) : ''
}

/** Summe der Prozente, wenn alle drei Makros in % sind (muss 100 ergeben); sonst null */
export function percentTotal(macros: Record<MacroKey, MacroInput>): number | null {
  if (!MACRO_KEYS.every((k) => macros[k].mode === 'percent')) return null
  return MACRO_KEYS.reduce((sum, k) => sum + (number(macros[k].value) ?? 0), 0)
}

export interface ProfilePreview {
  /** festes Tagesziel; null bei fehlendem oder ungültigem Budget */
  daily: number | null
  grams: Record<MacroKey, number | null>
  /** „Rest“ reicht nicht: die anderen Makros brauchen mehr als das Tagesziel */
  restNegative: boolean
}

const number = (text: string): number | null => {
  const v = parseDecimal(text)
  return typeof v === 'number' ? v : null
}

/**
 * Live-Ergebnis während der Eingabe („= 2.800 / Tag“, „≈ 133 g“); unfertige Eingaben ergeben null.
 * trendKg = heutiges Trendgewicht (aktive Verbrauchsschätzung); es geht dem Feld vor.
 */
export function profilePreview(values: ProfileFormValues, trendKg: number | null = null): ProfilePreview {
  const weekly = number(values.weeklyKcal)
  const none = { grams: { protein: null, fat: null, carbs: null }, restNegative: false }
  if (weekly === null || weekly <= 0) return { daily: null, ...none }
  const daily = fixedDailyTarget(weekly)

  const targets = {} as Record<MacroKey, MacroTarget>
  const missing = new Set<MacroKey>()
  for (const k of MACRO_KEYS) {
    const { mode, value } = values.macros[k]
    const v = mode === 'rest' ? null : number(value)
    if (mode !== 'rest' && v === null) missing.add(k)
    // Fehlende Werte vorläufig 0, damit die anderen trotzdem ein Ergebnis zeigen
    targets[k] = { mode, value: mode === 'rest' ? null : (v ?? 0) }
  }
  try {
    const r = macroGoals({ weeklyKcal: weekly, ...targets }, trendKg ?? number(values.weightKg))
    const grams = { ...r.grams }
    const restKey = MACRO_KEYS.find((k) => targets[k].mode === 'rest')
    for (const k of missing) grams[k] = null
    // Rest ist nur sinnvoll, wenn alle anderen eingegeben sind
    if (restKey && missing.size > 0) grams[restKey] = null
    return { daily, grams, restNegative: missing.size === 0 && r.issues.includes('restNegative') }
  } catch {
    // z. B. zwei Mal „Rest“ – zeigt die Prüfung beim Speichern
    return { daily, ...none }
  }
}

export type ProfileErrors = Partial<Record<'name' | 'weeklyKcal' | MacroKey | 'fiberG' | 'weightKg' | 'macros', string>>

export type ProfileFormResult = { ok: true; data: ProfileFormData } | { ok: false; errors: ProfileErrors }

export const MAX_PROFILE_NAME = 40

const LIMITS: Record<Exclude<MacroMode, 'rest'>, { max: number; unit: string }> = {
  g: { max: 1000, unit: 'g' },
  percent: { max: 100, unit: '%' },
  gPerKg: { max: 10, unit: 'g/kg' },
}

/**
 * Prüft das Formular. Verbietet nichts, was die App rechnen kann, aber fängt Tippfehler ab.
 * Mit Trendgewicht (trendKg) ist das Körpergewicht für g/kg nicht mehr Pflicht.
 */
export function validateProfileForm(values: ProfileFormValues, trendKg: number | null = null): ProfileFormResult {
  const errors: ProfileErrors = {}

  const name = values.name.trim()
  if (name === '') errors.name = 'Bitte einen Namen eingeben'
  else if (name.length > MAX_PROFILE_NAME) errors.name = `Höchstens ${MAX_PROFILE_NAME} Zeichen`

  const weekly = parseDecimal(values.weeklyKcal)
  if (weekly === null || weekly === 'invalid') errors.weeklyKcal = 'Bitte Wochenbudget eingeben'
  else if (weekly < 3500 || weekly > 70000) errors.weeklyKcal = 'Zwischen 3.500 und 70.000 kcal'

  const targets = {} as Record<MacroKey, MacroTarget>
  for (const k of MACRO_KEYS) {
    const { mode, value } = values.macros[k]
    if (mode === 'rest') {
      targets[k] = { mode, value: null }
      continue
    }
    const v = parseDecimal(value)
    const { max, unit } = LIMITS[mode]
    if (v === null || v === 'invalid') errors[k] = 'Bitte Wert eingeben'
    else if (v > max) errors[k] = `Höchstens ${formatNumber(max)} ${unit}`
    targets[k] = { mode, value: typeof v === 'number' ? v : null }
  }

  const rests = MACRO_KEYS.filter((k) => targets[k].mode === 'rest')
  if (rests.length > 1) errors.macros = 'Nur ein Makro kann „Rest“ sein'
  const percentSum = MACRO_KEYS.reduce(
    (sum, k) => (targets[k].mode === 'percent' ? sum + (targets[k].value ?? 0) : sum),
    0,
  )
  const allPercent = percentTotal(values.macros)
  if (allPercent !== null && Math.abs(allPercent - 100) > 1e-9) {
    errors.macros = `Prozente ergeben zusammen ${formatNumber(allPercent, allPercent % 1 === 0 ? 0 : 1)} %, es müssen 100 % sein`
  } else if (percentSum > 100) errors.macros = 'Prozente ergeben zusammen mehr als 100 %'

  const usesWeight = MACRO_KEYS.some((k) => targets[k].mode === 'gPerKg')
  const weight = parseDecimal(values.weightKg)
  if (weight === 'invalid') errors.weightKg = 'Bitte als Zahl, z. B. 74,0'
  else if (weight === null && usesWeight && trendKg === null) errors.weightKg = 'Für g/kg brauchst du dein Körpergewicht'
  else if (weight !== null && (weight < 30 || weight > 300)) errors.weightKg = 'Zwischen 30 und 300 kg'

  const fiber = parseDecimal(values.fiberG)
  if (fiber === 'invalid') errors.fiberG = 'Bitte als Zahl'
  else if (fiber !== null && fiber > 150) errors.fiberG = 'Höchstens 150 g'

  if (Object.keys(errors).length === 0 && rests.length === 1) {
    const r = macroGoals({ weeklyKcal: weekly as number, ...targets }, trendKg ?? (weight as number | null))
    const restKey = rests[0] as MacroKey
    if (r.issues.includes('restNegative')) errors[restKey] = 'Die anderen Makros brauchen schon das ganze Tagesziel'
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    data: {
      name,
      weeklyKcal: weekly as number,
      ...targets,
      fiberG: fiber as number | null,
      manualWeightKg: weight as number | null,
    },
  }
}

/** DOM-id eines Profilfelds, damit „Weiter“ zum ersten Fehler springen kann */
export const profileFieldId = (key: string) => `profil-${key}`
