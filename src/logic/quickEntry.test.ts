import { describe, expect, it } from 'vitest'
import { newRecord } from '../db/records.ts'
import type { Entry } from '../db/types.ts'
import {
  editedQuick,
  emptyQuick,
  macroCheck,
  macroCheckText,
  quickEntry,
  quickFromEntry,
  validateQuick,
  type QuickValues,
} from './quickEntry.ts'

const with_ = (fields: Partial<QuickValues['fields']>, name = '', cost = ''): QuickValues => ({
  name,
  fields: { ...emptyQuick().fields, ...fields },
  cost,
})

// Beispiel aus PLAN.md / Schnell.dc.html: 38/80/40 g gegen 850 kcal
const doener = with_({ kcal: '850', protein: '38', carbs: '80', fat: '40' }, 'Döner Teller')

describe('macroCheck', () => {
  it('PLAN.md: 38/80/40 → 832 kcal gegen 850: passt', () => {
    const c = macroCheck(doener)
    expect(c).toEqual({ fromMacros: 832, ok: true })
    expect(macroCheckText(c!)).toBe('Makros ergeben 832 kcal · passt')
  })

  it('mehr als 10 % daneben → Hinweis', () => {
    const c = macroCheck({ ...doener, fields: { ...doener.fields, kcal: '1000' } })
    expect(c?.ok).toBe(false)
    expect(macroCheckText(c!)).toBe('Makros ergeben 832 kcal · weicht über 10 % ab')
  })

  it('genau 10 % ist noch in Ordnung, nach oben und unten', () => {
    expect(macroCheck(with_({ kcal: '1000', protein: '0', carbs: '275', fat: '0' }))?.ok).toBe(true) // 1.100
    expect(macroCheck(with_({ kcal: '1000', protein: '0', carbs: '225', fat: '0' }))?.ok).toBe(true) // 900
    expect(macroCheck(with_({ kcal: '1000', protein: '0', carbs: '276', fat: '0' }))?.ok).toBe(false)
  })

  it('Dezimalkomma', () => {
    expect(macroCheck(with_({ kcal: '100', protein: '2,5', carbs: '20', fat: '0,5' }))?.fromMacros).toBe(94.5)
  })

  it('fehlt ein Makro oder kcal: keine Prüfung (unbekannt ist nicht 0)', () => {
    expect(macroCheck({ ...doener, fields: { ...doener.fields, fat: '' } })).toBeNull()
    expect(macroCheck({ ...doener, fields: { ...doener.fields, kcal: '' } })).toBeNull()
    expect(macroCheck({ ...doener, fields: { ...doener.fields, kcal: '0' } })).toBeNull()
  })
})

describe('validateQuick / quickEntry', () => {
  it('Eintrag ohne Produkt und Menge, leere Felder unbekannt', () => {
    const e = quickEntry(doener, '2026-10-21', 'abend')
    expect(e).toMatchObject({ kind: 'quick', ref: null, amount: null, unit: null, nameSnapshot: 'Döner Teller', slotId: 'abend' })
    expect(e.nutrients).toMatchObject({ kcal: 850, protein: 38, carbs: 80, fat: 40, fiber: null, salt: null })
  })

  it('Name optional', () => {
    expect(quickEntry(with_({ kcal: '300' }, '  '), '2026-10-21', 's').nameSnapshot).toBe('Schnelleintrag')
  })

  it('nur kcal Pflicht; Abweichung sperrt nicht', () => {
    expect(validateQuick(with_({ protein: '30' }))).toMatchObject({ ok: false, field: 'kcal' })
    expect(validateQuick(with_({ kcal: '0' })).ok).toBe(false)
    expect(validateQuick(with_({ kcal: '100', protein: '100' })).ok).toBe(true)
  })

  it('Grenzen fangen Tippfehler ab', () => {
    expect(validateQuick(with_({ kcal: '10001' }))).toMatchObject({ ok: false, field: 'kcal' })
    expect(validateQuick(with_({ kcal: '500', salt: '101' }))).toMatchObject({ ok: false, field: 'salt' })
  })

  it('Preis optional: leer = unbekannt, Dezimalkomma, 0 €', () => {
    expect(quickEntry(with_({ kcal: '850' }), '2026-10-21', 's').cost).toBeNull()
    expect(quickEntry(with_({ kcal: '850' }, 'Döner', '7,5'), '2026-10-21', 's').cost).toBe(7.5)
    expect(quickEntry(with_({ kcal: '850' }, 'Kantine', '0'), '2026-10-21', 's').cost).toBe(0)
    expect(quickEntry(with_({ kcal: '850' }, '', '12,'), '2026-10-21', 's').cost).toBe(12)
  })

  it('Preis über 1.000 € ist ein Tippfehler', () => {
    expect(validateQuick(with_({ kcal: '850' }, '', '1001'))).toEqual({ ok: false, error: 'Preis: Höchstens 1.000 €', field: 'cost' })
  })

  it('weitere Nährwerte werden übernommen', () => {
    const e = quickEntry(with_({ kcal: '500', fiber: '7,5', salt: '2,1' }), '2026-10-21', 's')
    expect(e.nutrients).toMatchObject({ fiber: 7.5, salt: 2.1 })
  })
})

describe('Bearbeiten', () => {
  const stored = newRecord<Entry>(quickEntry(doener, '2026-10-21', 'abend'))

  it('quickFromEntry: Hin und zurück', () => {
    const values = quickFromEntry(stored)
    expect(values.name).toBe('Döner Teller')
    expect(values.fields.kcal).toBe('850')
    expect(values.fields.fiber).toBe('')
    expect(editedQuick(values, '2026-10-20', 'mittag')).toMatchObject({
      date: '2026-10-20',
      slotId: 'mittag',
      nameSnapshot: 'Döner Teller',
      nutrients: stored.nutrients,
    })
  })

  it('Preis: Hin und zurück, auch wenn er (bei ausgeschalteter Kostenauswertung) nicht angefasst wird', () => {
    const withCost = newRecord<Entry>(quickEntry({ ...doener, cost: '12,9' }, '2026-10-21', 'abend'))
    const values = quickFromEntry(withCost)
    expect(values.cost).toBe('12,9')
    expect(editedQuick(values, '2026-10-21', 'abend').cost).toBe(12.9)
    expect(editedQuick({ ...values, cost: '' }, '2026-10-21', 'abend').cost).toBeNull()
    expect(quickFromEntry(stored).cost).toBe('')
  })

  it('Standardname wird beim Bearbeiten nicht zum Feldinhalt', () => {
    const plain = newRecord<Entry>(quickEntry(with_({ kcal: '300,5' }), '2026-10-21', 's'))
    expect(quickFromEntry(plain)).toMatchObject({ name: '', fields: { kcal: '300,5' } })
  })
})
