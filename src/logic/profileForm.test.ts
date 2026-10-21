import { describe, expect, it } from 'vitest'
import type { ProfileVersion } from '../db/types.ts'
import {
  changeMode,
  emptyProfileForm,
  nextMode,
  presetFor,
  presetMacros,
  profilePreview,
  profileToForm,
  validateProfileForm,
  type ProfileFormValues,
} from './profileForm.ts'

// Beispiel aus Start.dc.html
const aufbau: ProfileFormValues = { ...emptyProfileForm(), name: 'Aufbau', weeklyKcal: '19600', weightKg: '74,0' }

describe('profilePreview', () => {
  it('Start.dc.html: = 2.800 / Tag, ≈ 133 / 78 / 392 g', () => {
    const p = profilePreview(aufbau)
    expect(p.daily).toBe(2800)
    expect(p.grams.protein).toBeCloseTo(133.2, 10)
    expect(p.grams.fat).toBeCloseTo(77.78, 2)
    expect(p.grams.carbs).toBeCloseTo(391.8, 10)
    expect(p.restNegative).toBe(false)
  })

  it('ohne Budget: nichts berechenbar', () => {
    expect(profilePreview({ ...aufbau, weeklyKcal: '' })).toMatchObject({ daily: null, grams: { fat: null } })
    expect(profilePreview({ ...aufbau, weeklyKcal: 'abc' }).daily).toBeNull()
  })

  it('fehlendes Gewicht: g/kg und Rest unbekannt, % trotzdem', () => {
    const p = profilePreview({ ...aufbau, weightKg: '' })
    expect(p.grams.protein).toBeNull()
    expect(p.grams.carbs).toBeNull()
    expect(p.grams.fat).toBeCloseTo(77.78, 2)
  })

  it('unfertiger Makro-Wert: dieses und Rest unbekannt', () => {
    const p = profilePreview({ ...aufbau, macros: { ...aufbau.macros, fat: { mode: 'percent', value: '' } } })
    expect(p.grams.fat).toBeNull()
    expect(p.grams.carbs).toBeNull()
    expect(p.grams.protein).toBeCloseTo(133.2, 10)
  })

  it('Rest reicht nicht', () => {
    const v = { ...aufbau, weeklyKcal: '10000', macros: { ...aufbau.macros, fat: { mode: 'percent' as const, value: '70' } } }
    expect(profilePreview(v).restNegative).toBe(true)
  })
})

describe('Modi und Vorlagen', () => {
  it('nextMode: g/kg nur für Eiweiß und Fett', () => {
    expect(nextMode('protein', 'g')).toBe('percent')
    expect(nextMode('protein', 'percent')).toBe('gPerKg')
    expect(nextMode('protein', 'gPerKg')).toBe('rest')
    expect(nextMode('protein', 'rest')).toBe('g')
    expect(nextMode('carbs', 'percent')).toBe('rest')
  })

  it('presetFor erkennt Vorlagen, eigene Mischung = null', () => {
    expect(presetFor(presetMacros('mixed'))).toBe('mixed')
    expect(presetFor(presetMacros('grams'))).toBe('grams')
    expect(presetFor({ ...presetMacros('grams'), carbs: { mode: 'rest', value: '' } })).toBeNull()
  })

  it('presetMacros liefert Kopien', () => {
    const a = presetMacros('mixed')
    a.protein.value = '9'
    expect(presetMacros('mixed').protein.value).toBe('1,8')
  })

  it('changeMode: neuer Rest macht alten Rest zu Gramm mit seinem Ergebnis', () => {
    const v = changeMode(aufbau, 'fat', 'rest')
    expect(v.macros.fat).toEqual({ mode: 'rest', value: '' })
    expect(v.macros.carbs).toEqual({ mode: 'g', value: '392' })
  })

  it('changeMode: anderer Modus behält den Wert', () => {
    expect(changeMode(aufbau, 'fat', 'g').macros.fat).toEqual({ mode: 'g', value: '25' })
  })
})

describe('validateProfileForm', () => {
  it('Beispiel ist gültig', () => {
    const r = validateProfileForm(aufbau)
    expect(r).toEqual({
      ok: true,
      data: {
        name: 'Aufbau',
        weeklyKcal: 19600,
        protein: { mode: 'gPerKg', value: 1.8 },
        fat: { mode: 'percent', value: 25 },
        carbs: { mode: 'rest', value: null },
        fiberG: 30,
        waterMl: null,
        manualWeightKg: 74,
      },
    })
  })

  it('Pflicht: Name, Budget', () => {
    const r = validateProfileForm({ ...aufbau, name: ' ', weeklyKcal: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['name', 'weeklyKcal'])
  })

  it('Budget-Grenzen', () => {
    expect(validateProfileForm({ ...aufbau, weeklyKcal: '3000' }).ok).toBe(false)
    expect(validateProfileForm({ ...aufbau, weeklyKcal: '3500', macros: presetMacros('percent') }).ok).toBe(true)
    expect(validateProfileForm({ ...aufbau, weeklyKcal: '19.600' }).ok).toBe(false) // Punkt = Dezimal, nicht Tausender
  })

  it('g/kg braucht Gewicht; ohne g/kg ist es optional', () => {
    const r = validateProfileForm({ ...aufbau, weightKg: '' })
    expect(!r.ok && r.errors.weightKg).toMatch(/Körpergewicht/)
    const grams = { ...aufbau, weightKg: '', macros: presetMacros('grams') }
    expect(validateProfileForm(grams)).toMatchObject({ ok: true, data: { manualWeightKg: null } })
  })

  it('Grenzen je Modus', () => {
    const tooMuch = (mode: 'g' | 'percent' | 'gPerKg', value: string) =>
      validateProfileForm({ ...aufbau, macros: { ...aufbau.macros, protein: { mode, value } } })
    expect(tooMuch('percent', '101').ok).toBe(false)
    expect(tooMuch('gPerKg', '11').ok).toBe(false)
    expect(tooMuch('g', '1001').ok).toBe(false)
  })

  it('höchstens ein Rest, Prozente höchstens 100', () => {
    const twoRests = { ...aufbau, macros: { ...aufbau.macros, fat: { mode: 'rest' as const, value: '' } } }
    expect(!validateProfileForm(twoRests).ok && validateProfileForm(twoRests)).toMatchObject({ errors: { macros: /Rest/ } })
    const over = { ...aufbau, macros: { protein: { mode: 'percent' as const, value: '40' }, fat: { mode: 'percent' as const, value: '40' }, carbs: { mode: 'percent' as const, value: '30' } } }
    expect(validateProfileForm(over)).toMatchObject({ ok: false, errors: { macros: /100 %/ } })
  })

  it('Rest reicht nicht → Fehler am Rest-Makro', () => {
    const v = { ...aufbau, weeklyKcal: '10000', macros: { ...aufbau.macros, fat: { mode: 'percent' as const, value: '70' } } }
    expect(validateProfileForm(v)).toMatchObject({ ok: false, errors: { carbs: /Tagesziel/ } })
  })

  it('Ballaststoffe optional', () => {
    expect(validateProfileForm({ ...aufbau, fiberG: '' })).toMatchObject({ ok: true, data: { fiberG: null } })
  })
})

describe('profileToForm', () => {
  it('Hin und zurück', () => {
    const r = validateProfileForm(aufbau)
    if (!r.ok) throw new Error('ungültig')
    const { name, ...data } = r.data
    const version = { ...data, id: 'v', profileId: 'p' } as ProfileVersion
    expect(validateProfileForm(profileToForm(name, version))).toEqual(r)
    expect(profileToForm(name, version).weightKg).toBe('74')
  })
})
