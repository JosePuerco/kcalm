import { describe, expect, it } from 'vitest'
import { newRecord, softDelete } from '../db/records.ts'
import type { Nutrients, ProductOverride } from '../db/types.ts'
import {
  canVerify,
  compareRows,
  correctionFromValues,
  countCorrected,
  effectiveNutrients,
  isEmptyOverride,
  isVerified,
  mergeNutrients,
  missingForVerify,
  rebaseOnOffUpdate,
  type Correction,
} from './verify.ts'

// Skyr natur aus Produkt.dc.html
const original: Nutrients = {
  kcal: 63,
  fat: 0.2,
  satFat: 0.1,
  carbs: 4,
  sugar: 4,
  fiber: null,
  protein: 11,
  salt: 0.1,
  water: null,
}

const override = (per100: Correction, verifiedAt: string | null = null) =>
  newRecord<ProductOverride>({ productRef: 'product:skyr', per100, verifiedAt, note: null })

describe('mergeNutrients', () => {
  it('ohne Korrektur gilt das Original', () => {
    expect(mergeNutrients(original, undefined)).toEqual(original)
  })

  it('fehlendes Feld = Original, Zahl = eigener Wert, null = bewusst unbekannt', () => {
    const mine = mergeNutrients(original, override({ carbs: 3.5, fiber: 0, salt: null }))
    expect(mine.carbs).toBe(3.5)
    expect(mine.fiber).toBe(0)
    expect(mine.salt).toBeNull()
    expect(mine.kcal).toBe(63)
  })

  it('gelöschte Korrektur zählt nicht', () => {
    expect(mergeNutrients(original, softDelete(override({ kcal: 99 })))).toEqual(original)
  })

  it('ändert das Original nicht', () => {
    const copy = { ...original }
    mergeNutrients(original, override({ kcal: 70 }))
    expect(original).toEqual(copy)
  })
})

describe('effectiveNutrients', () => {
  const o = override({ kcal: 65 })
  it('Meine Werte nutzen', () => expect(effectiveNutrients(original, o, true).kcal).toBe(65))
  it('Original nutzen', () => expect(effectiveNutrients(original, o, false).kcal).toBe(63))
})

describe('compareRows / countCorrected', () => {
  it('markiert Abweichungen, auch unbekannt ↔ bekannt', () => {
    const o = override({ carbs: 3.5, sugar: 3.5, fiber: 0, salt: 0.13 })
    const rows = compareRows(original, o)
    expect(rows.filter((r) => r.differs).map((r) => r.key)).toEqual(['carbs', 'sugar', 'fiber', 'salt'])
    expect(rows.find((r) => r.key === 'fiber')).toEqual({ key: 'fiber', original: null, mine: 0, differs: true })
    expect(countCorrected(original, o)).toBe(4)
  })

  it('Korrektur mit gleichem Wert ist keine Abweichung', () => {
    expect(countCorrected(original, override({ kcal: 63 }))).toBe(0)
  })

  it('beide unbekannt ist keine Abweichung', () => {
    expect(compareRows(original, undefined).find((r) => r.key === 'water')?.differs).toBe(false)
  })
})

describe('canVerify', () => {
  it('alle Pflichtangaben bekannt', () => {
    expect(canVerify(original)).toBe(true)
  })

  it('Ballaststoffe und Wasser sind nicht Pflicht', () => {
    expect(canVerify({ ...original, fiber: null, water: null })).toBe(true)
  })

  it('fehlt eine Pflichtangabe, geht es nicht; die fehlenden werden genannt', () => {
    const mine = { ...original, satFat: null, salt: null }
    expect(canVerify(mine)).toBe(false)
    expect(missingForVerify(mine)).toEqual(['satFat', 'salt'])
  })

  it('0 ist bekannt, nicht fehlend', () => {
    expect(canVerify({ ...original, fat: 0, satFat: 0 })).toBe(true)
  })

  it('Korrektur kann eine Lücke im Original füllen', () => {
    const gap = { ...original, satFat: null }
    expect(canVerify(mergeNutrients(gap, override({ satFat: 0.1 })))).toBe(true)
  })
})

describe('isVerified', () => {
  it('eigene Produkte immer', () => expect(isVerified('own', undefined)).toBe(true))
  it('OFF ohne Korrektur nicht', () => expect(isVerified('off', undefined)).toBe(false))
  it('Korrektur ohne Prüfdatum nicht', () => expect(isVerified('off', override({ kcal: 65 }))).toBe(false))
  it('mit Prüfdatum, auch ohne geänderte Felder („Stimmt so“)', () => {
    expect(isVerified('bls', override({}, '2026-10-21T08:00:00.000Z'))).toBe(true)
  })
  it('gelöschte Prüfung nicht', () => {
    expect(isVerified('off', softDelete(override({}, '2026-10-21T08:00:00.000Z')))).toBe(false)
  })
})

describe('correctionFromValues / isEmptyOverride', () => {
  it('speichert nur Felder, die vom Original abweichen', () => {
    const edited = { ...original, carbs: 3.5, fiber: 0 }
    expect(correctionFromValues(original, edited)).toEqual({ carbs: 3.5, fiber: 0 })
  })

  it('auf unbekannt gesetzt wird als null gespeichert', () => {
    expect(correctionFromValues(original, { ...original, salt: null })).toEqual({ salt: null })
  })

  it('alles zurück auf Original → leer; ohne Prüfung braucht es keinen Datensatz', () => {
    const c = correctionFromValues(original, { ...original })
    expect(c).toEqual({})
    expect(isEmptyOverride(c, null)).toBe(true)
    expect(isEmptyOverride(c, '2026-10-21T08:00:00.000Z')).toBe(false)
    expect(isEmptyOverride({ kcal: 65 }, null)).toBe(false)
  })
})

describe('rebaseOnOffUpdate', () => {
  it('OFF-Update überschreibt Korrektur nicht', () => {
    const before = override({ carbs: 3.5 }, '2026-10-12T08:00:00.000Z')
    const mineBefore = mergeNutrients(original, before)
    const updated: Nutrients = { ...original, kcal: 65, carbs: 4.2 }

    const per100 = rebaseOnOffUpdate(original, updated, before.per100)
    const after = { ...before, per100 }

    // Korrektur bleibt, geänderte Felder werden mit dem alten Wert festgehalten
    expect(per100).toEqual({ carbs: 3.5, kcal: 63 })
    expect(mergeNutrients(updated, after)).toEqual(mineBefore)
    // Die Änderung von OFF ist jetzt eine sichtbare Abweichung
    expect(countCorrected(updated, after)).toBe(2)
  })

  it('unveränderte Felder bleiben ohne Korrektur', () => {
    expect(rebaseOnOffUpdate(original, { ...original }, { carbs: 3.5 })).toEqual({ carbs: 3.5 })
  })

  it('bewusst unbekannt (null) bleibt unbekannt, auch wenn OFF jetzt einen Wert hat', () => {
    const updated = { ...original, salt: 0.12 }
    const per100 = rebaseOnOffUpdate(original, updated, { salt: null })
    expect(per100).toEqual({ salt: null })
    expect(mergeNutrients(updated, override(per100)).salt).toBeNull()
  })

  it('OFF-Feld wird unbekannt → Meine behält den alten Wert', () => {
    const updated = { ...original, protein: null }
    const per100 = rebaseOnOffUpdate(original, updated, {})
    expect(per100).toEqual({ protein: 11 })
  })

  it('OFF übernimmt den korrigierten Wert → Korrektur fällt weg, Meine bleibt gleich', () => {
    const updated = { ...original, carbs: 3.5 }
    const per100 = rebaseOnOffUpdate(original, updated, { carbs: 3.5 })
    expect(per100).toEqual({})
    expect(mergeNutrients(updated, override(per100)).carbs).toBe(3.5)
  })

  it('OFF gibt einen vorher unbekannten Wert → festgehalten als unbekannt', () => {
    const updated = { ...original, fiber: 0.5 }
    expect(rebaseOnOffUpdate(original, updated, {})).toEqual({ fiber: null })
  })
})
