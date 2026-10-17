import { describe, expect, it } from 'vitest'
import { NUTRIENT_KEYS } from '../db/records.ts'
import { parseBlsFile } from './blsFoods.ts'

const fields = ['code', 'name', ...NUTRIENT_KEYS]
const file = (rows: unknown[]) => ({ source: 'MRI', version: '4.0', fields, rows })

describe('parseBlsFile', () => {
  it('wandelt Zeilen in Lebensmittel mit Nutrients um', () => {
    const foods = parseBlsFile(file([['C133000', 'Hafer Flocken', 348, 6.65, 1.34, 53.3, 0.74, 10.983, 13.22, 0.005, 10.07, 0]]))
    expect(foods).toEqual([
      {
        code: 'C133000',
        name: 'Hafer Flocken',
        per100: {
          kcal: 348,
          fat: 6.65,
          satFat: 1.34,
          carbs: 53.3,
          sugar: 0.74,
          fiber: 10.983,
          protein: 13.22,
          salt: 0.005,
          water: 10.07,
          alcohol: 0,
        },
      },
    ])
  })

  it('null bleibt unbekannt', () => {
    const [most] = parseBlsFile(file([['P355000', 'Most', 37, 0, 0, 1.6, 1.6, null, 0, 0.01, 91.4, 4.2]]))
    expect(most!.per100.fiber).toBeNull()
    expect(most!.per100.fat).toBe(0)
  })

  it('lehnt falsche Feldreihenfolge ab', () => {
    const swapped = { ...file([]), fields: ['code', 'name', 'fat', 'kcal', ...NUTRIENT_KEYS.slice(2)] }
    expect(() => parseBlsFile(swapped)).toThrow('unerwartete Felder')
  })

  it('lehnt unvollständige Zeilen, Text statt Zahl und negative Werte ab', () => {
    expect(() => parseBlsFile(file([['C1', 'A', 1, 2]]))).toThrow('unvollständig')
    expect(() => parseBlsFile(file([['C1', 'A', '1', 0, 0, 0, 0, 0, 0, 0, 0, 0]]))).toThrow()
    expect(() => parseBlsFile(file([['C1', 'A', -1, 0, 0, 0, 0, 0, 0, 0, 0, 0]]))).toThrow()
  })

  it('lehnt Unsinn ab', () => {
    expect(() => parseBlsFile(null)).toThrow()
    expect(() => parseBlsFile({ rows: 'x' })).toThrow()
  })
})
