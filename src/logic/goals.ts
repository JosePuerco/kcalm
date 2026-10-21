// Tagesziele, Wochenstand und Makroziele. Reine Funktionen, exakt gerechnet; gerundet wird erst in der Anzeige.
// Formeln und Beispiele: PLAN.md Abschnitt 2 „Berechnungen“.

import type { LocalDate, MacroTarget, ProfileVersion } from '../db/types.ts'
import { daysLeftInWeek, weekDates, weekStart } from './dates.ts'

/** Festes Tagesziel = Wochenbudget ÷ 7 (Basis für Makros in %) */
export function fixedDailyTarget(weeklyKcal: number): number {
  return weeklyKcal / 7
}

/**
 * Dynamisches Tagesziel = (Wochenbudget − Verbrauch der Vortage) ÷ verbleibende Tage inkl. heute.
 * Kann negativ werden, wenn das Budget schon überschritten ist; die Anzeige zeigt dann „kcal drüber“.
 */
export function dynamicDailyTarget(weekBudget: number, consumedBefore: number, daysLeft: number): number {
  if (!Number.isInteger(daysLeft) || daysLeft < 1 || daysLeft > 7) {
    throw new RangeError(`Ungültige Anzahl verbleibender Tage: ${daysLeft}`)
  }
  return (weekBudget - consumedBefore) / daysLeft
}

/** kcal je Tag (bekannte Summe); fehlender Tag = 0 */
export type KcalByDate = Readonly<Record<LocalDate, number>>

/**
 * Dynamisches Tagesziel für einen angezeigten Tag.
 * - Heute oder Vergangenheit: Vortage dieser Woche zählen, so wie es an dem Tag war.
 * - Zukunft: vorgeplante Einträge zählen nicht; in dieser Woche gilt das heutige Ziel ohne heutigen
 *   Verbrauch, in einer künftigen Woche das Budget ÷ 7.
 */
export function dynamicTargetFor(date: LocalDate, today: LocalDate, kcalByDate: KcalByDate, weekBudget: number): number {
  const monday = weekStart(date)
  const pivot = date <= today ? date : today > monday ? today : monday
  let consumedBefore = 0
  for (const d of weekDates(date)) if (d < pivot) consumedBefore += kcalByDate[d] ?? 0
  return dynamicDailyTarget(weekBudget, consumedBefore, daysLeftInWeek(pivot))
}

export interface WeekDay {
  date: LocalDate
  kcal: number
  isToday: boolean
  /** Nach heute: vorgeplant, zählt nicht zum Verbrauch */
  isFuture: boolean
}

export interface WeekStatus {
  days: WeekDay[]
  /** Verbrauch der Woche bis einschließlich heute */
  consumed: number
  budget: number
  /** Budget − Verbrauch; negativ = drüber */
  remaining: number
  fixedTarget: number
}

/** Wochenstand für die Woche, in der das Datum liegt (Zeile „Woche 10.302 / 19.600 kcal“ + 7 Balken) */
export function weekStatus(date: LocalDate, today: LocalDate, kcalByDate: KcalByDate, weekBudget: number): WeekStatus {
  const days = weekDates(date).map((d) => ({
    date: d,
    kcal: kcalByDate[d] ?? 0,
    isToday: d === today,
    isFuture: d > today,
  }))
  const consumed = days.reduce((sum, d) => (d.isFuture ? sum : sum + d.kcal), 0)
  return {
    days,
    consumed,
    budget: weekBudget,
    remaining: weekBudget - consumed,
    fixedTarget: fixedDailyTarget(weekBudget),
  }
}

export type MacroKey = 'protein' | 'fat' | 'carbs'
export const MACRO_KEYS: readonly MacroKey[] = ['protein', 'fat', 'carbs']

/** kcal pro Gramm: Eiweiß und Kohlenhydrate 4, Fett 9 */
export const KCAL_PER_GRAM: Readonly<Record<MacroKey, number>> = { protein: 4, fat: 9, carbs: 4 }

/** g/kg ist nur für Eiweiß und Fett vorgesehen */
export const GPERKG_MACROS: readonly MacroKey[] = ['protein', 'fat']

export type MacroIssue =
  /** g/kg ohne Körpergewicht: Ergebnis unbekannt */
  | 'missingWeight'
  /** Die übrigen Makros brauchen mehr kcal als das Tagesziel hat; „Rest“ wird 0 */
  | 'restNegative'

export interface MacroGoals {
  /** Gramm pro Tag; null = nicht berechenbar (z. B. g/kg ohne Gewicht) */
  grams: Record<MacroKey, number | null>
  issues: MacroIssue[]
}

/** Prüft die Einstellung und meldet Fehler, die die Oberfläche nicht zulassen darf */
export function validateMacroModes(targets: Record<MacroKey, MacroTarget>): string | null {
  const rests = MACRO_KEYS.filter((k) => targets[k].mode === 'rest')
  if (rests.length > 1) return 'Nur ein Makro kann „Rest“ sein.'
  for (const k of MACRO_KEYS) {
    const t = targets[k]
    if (t.mode === 'gPerKg' && !GPERKG_MACROS.includes(k)) return 'g/kg gibt es nur für Eiweiß und Fett.'
    if (t.mode !== 'rest' && (t.value === null || !Number.isFinite(t.value) || t.value < 0)) {
      return 'Jedes Makro braucht einen Wert.'
    }
  }
  return null
}

/**
 * Makroziele in Gramm pro Tag.
 * - g: Wert direkt
 * - %: festes Tagesziel × Anteil ÷ kcal pro g   (2.800 × 25 % ÷ 9 = 77,8 g Fett)
 * - g/kg: Faktor × Körpergewicht                 (1,8 × 74,0 = 133,2 g Eiweiß)
 * - Rest: (festes Tagesziel − kcal der anderen) ÷ kcal pro g  (≈ 392 g KH)
 */
export function macroGoals(
  version: Pick<ProfileVersion, 'weeklyKcal' | MacroKey>,
  weightKg: number | null,
): MacroGoals {
  const invalid = validateMacroModes(version)
  if (invalid) throw new RangeError(invalid)

  const day = fixedDailyTarget(version.weeklyKcal)
  const issues = new Set<MacroIssue>()
  const grams = { protein: null, fat: null, carbs: null } as Record<MacroKey, number | null>

  for (const k of MACRO_KEYS) {
    const { mode, value } = version[k]
    if (mode === 'g') grams[k] = value
    else if (mode === 'percent') grams[k] = (day * (value as number)) / 100 / KCAL_PER_GRAM[k]
    else if (mode === 'gPerKg') {
      if (weightKg === null || weightKg <= 0) issues.add('missingWeight')
      else grams[k] = (value as number) * weightKg
    }
  }

  const restKey = MACRO_KEYS.find((k) => version[k].mode === 'rest')
  if (restKey) {
    const others = MACRO_KEYS.filter((k) => k !== restKey)
    // Ohne die anderen Werte lässt sich der Rest nicht bestimmen
    if (others.every((k) => grams[k] !== null)) {
      const used = others.reduce((sum, k) => sum + (grams[k] as number) * KCAL_PER_GRAM[k], 0)
      const rest = (day - used) / KCAL_PER_GRAM[restKey]
      if (rest < 0) issues.add('restNegative')
      grams[restKey] = Math.max(0, rest)
    }
  }

  return { grams, issues: [...issues] }
}
