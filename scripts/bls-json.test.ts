import { describe, expect, it } from 'vitest'
import { NUTRIENT_KEYS } from '../src/db/records.ts'
import { BLS_NUTRIENTS, buildBlsFile, findColumns, parseNutrientCell, stringifyBlsFile, type Cell } from './bls-json.ts'

// Kopfzeile wie in der echten Datei (gekürzt), je Nährstoff Gehalt, Datenherkunft, Referenz
const nutrientColumns = [
  ['ENERCC', 'Energie (Kilokalorien) [kcal/100g]'],
  ['WATER', 'Wasser [g/100g]'],
  ['PROT625', 'Protein (Nx6,25) [g/100g]'],
  ['FAT', 'Fett [g/100g]'],
  ['CHO', 'Kohlenhydrate, verfügbar [g/100g]'],
  ['FIBT', 'Ballaststoffe, gesamt [g/100g]'],
  ['ALC', 'Alkohol (Ethanol) [g/100g]'],
  ['NACL', 'Salz (Natriumchlorid) [g/100g]'],
  ['SUGAR', 'Zucker (Mono- und Disaccharide), gesamt [g/100g]'],
  ['FASAT', 'Fettsäuren, gesättigt, gesamt [g/100g]'],
]
const header: Cell[] = [
  'BLS Code',
  'Lebensmittelbezeichnung',
  'Food name',
  'ENERCJ Energie (Kilojoule) [kJ/100g]',
  'ENERCJ Datenherkunft',
  'ENERCJ Referenz',
  ...nutrientColumns.flatMap(([code, title]) => [`${code} ${title}`, `${code} Datenherkunft`, `${code} Referenz`]),
  'FATRN Fettsäuren, trans [g/100g]', // ähnliches Kürzel, darf nicht verwechselt werden
]

/** Zeile in Excel-Reihenfolge aus Werten je Kürzel bauen */
function row(code: Cell, name: Cell, values: Partial<Record<string, Cell>>): Cell[] {
  return [
    code,
    name,
    'english',
    1000,
    'Formelberechnung',
    'ref',
    ...nutrientColumns.flatMap(([c]) => [values[c as string], 'Formelberechnung', 'ref']),
    0.1,
  ]
}

const oats = row('C133000', 'Hafer Flocken', {
  ENERCC: 348,
  WATER: 10.07,
  PROT625: 13.22,
  FAT: 6.65,
  CHO: 53.3,
  FIBT: 10.983000000000001,
  ALC: 0,
  NACL: 4.9500000000000004e-3,
  SUGAR: 0.74,
  FASAT: 1.34,
})

describe('parseNutrientCell', () => {
  it('übernimmt Zahlen und Zahlen als Text', () => {
    expect(parseNutrientCell(348)).toBe(348)
    expect(parseNutrientCell('11.375')).toBe(11.375)
    expect(parseNutrientCell('4.9500000000000004E-3')).toBe(0.005)
  })

  it('akzeptiert Dezimalkomma', () => {
    expect(parseNutrientCell('2,5')).toBe(2.5)
  })

  it('entfernt Rechen-Rauschen durch Runden auf 3 Stellen', () => {
    expect(parseNutrientCell(9.3000000000000007)).toBe(9.3)
    expect(parseNutrientCell(64.099999999999994)).toBe(64.1)
    expect(parseNutrientCell(0.56279999999999997)).toBe(0.563)
  })

  it('behält echte Nullen als 0', () => {
    expect(parseNutrientCell(0)).toBe(0)
    expect(parseNutrientCell('0')).toBe(0)
  })

  it('fehlender Wert „-“, leere und fehlende Zellen werden null, nie 0', () => {
    expect(parseNutrientCell('-')).toBeNull()
    expect(parseNutrientCell(' - ')).toBeNull()
    expect(parseNutrientCell('')).toBeNull()
    expect(parseNutrientCell(null)).toBeNull()
    expect(parseNutrientCell(undefined)).toBeNull()
  })

  it('Spuren und Werte unter der Messgrenze werden 0', () => {
    expect(parseNutrientCell('TR')).toBe(0)
    expect(parseNutrientCell('<LOD')).toBe(0)
    expect(parseNutrientCell('<LOQ')).toBe(0)
    expect(parseNutrientCell('<LOD or <LOQ')).toBe(0)
  })

  it('bricht bei unbekannten Kürzeln ab statt zu raten', () => {
    expect(() => parseNutrientCell('n.a.')).toThrow('Unbekannter BLS-Wert')
    expect(() => parseNutrientCell('ca. 5')).toThrow()
    expect(() => parseNutrientCell('1.2.3')).toThrow()
  })

  it('bricht bei negativen oder unendlichen Werten ab', () => {
    expect(() => parseNutrientCell(-1)).toThrow('Ungültiger BLS-Wert')
    expect(() => parseNutrientCell(Number.NaN)).toThrow()
    expect(() => parseNutrientCell(Number.POSITIVE_INFINITY)).toThrow()
  })

  it('bricht bei unerwarteten Zelltypen ab', () => {
    expect(() => parseNutrientCell(true)).toThrow('Zelltyp')
    expect(() => parseNutrientCell(new Date())).toThrow()
  })
})

describe('findColumns', () => {
  it('findet nur die Gehalt-Spalten, nicht Datenherkunft oder Referenz', () => {
    const cols = findColumns(header)
    expect(cols.code).toBe(0)
    expect(cols.name).toBe(1)
    expect(cols.nutrients.map((i) => header[i])).toEqual([
      'ENERCC Energie (Kilokalorien) [kcal/100g]',
      'FAT Fett [g/100g]',
      'FASAT Fettsäuren, gesättigt, gesamt [g/100g]',
      'CHO Kohlenhydrate, verfügbar [g/100g]',
      'SUGAR Zucker (Mono- und Disaccharide), gesamt [g/100g]',
      'FIBT Ballaststoffe, gesamt [g/100g]',
      'PROT625 Protein (Nx6,25) [g/100g]',
      'NACL Salz (Natriumchlorid) [g/100g]',
    ])
  })

  it('meldet eine fehlende Spalte mit Namen', () => {
    const withoutSalt = header.filter((t) => !String(t).startsWith('NACL'))
    expect(() => findColumns(withoutSalt)).toThrow('BLS-Spalte „NACL“ fehlt')
  })
})

describe('buildBlsFile', () => {
  it('Nährwert-Reihenfolge stimmt mit dem Datenmodell überein', () => {
    expect([...BLS_NUTRIENTS]).toEqual([...NUTRIENT_KEYS])
  })

  it('wandelt eine Zeile in [Code, Name, Nährwerte] um', () => {
    const file = buildBlsFile([header, oats])
    expect(file.version).toBe('4.0')
    expect(file.source).toContain('Max Rubner-Institut')
    expect(file.fields).toEqual(['code', 'name', ...NUTRIENT_KEYS])
    expect(file.rows).toEqual([['C133000', 'Hafer Flocken', 348, 6.65, 1.34, 53.3, 0.74, 10.983, 13.22, 0.005]])
  })

  it('übernimmt fehlende und Spuren-Werte richtig in die Zeile', () => {
    const file = buildBlsFile([
      header,
      row('N100000', 'Testgetränk', { ENERCC: 0, FAT: '-', FASAT: '-', ALC: 4.2, PROT625: 'TR', CHO: 0, NACL: 0, SUGAR: '<LOD' }),
    ])
    const [, , kcal, fat, satFat, , sugar, fiber, protein] = file.rows[0]!
    expect(kcal).toBe(0)
    expect(fat).toBeNull()
    expect(satFat).toBeNull()
    expect(sugar).toBe(0)
    expect(fiber).toBeNull() // Zelle gar nicht befüllt
    expect(protein).toBe(0)
  })

  it('übernimmt Alkohol nicht, obwohl die Spalte in der Datei steht', () => {
    const file = buildBlsFile([header, row('N100000', 'Bier', { ENERCC: 42, ALC: 3.9 })])
    expect(file.rows[0]).toHaveLength(2 + NUTRIENT_KEYS.length)
    expect(file.rows[0]).not.toContain(3.9)
  })

  it('akzeptiert Codes mit Buchstaben im Inneren (z. B. M5B1600)', () => {
    const file = buildBlsFile([header, row('M5B1600', 'A', {}), row('X32A513', 'B', {})])
    expect(file.rows.map((r) => r[0])).toEqual(['M5B1600', 'X32A513'])
  })

  it('überspringt leere Zeilen und kürzt Leerzeichen', () => {
    const file = buildBlsFile([header, [], [null, null, ''], row(' C133000 ', ' Hafer Flocken ', {})])
    expect(file.rows).toHaveLength(1)
    expect(file.rows[0]![0]).toBe('C133000')
    expect(file.rows[0]![1]).toBe('Hafer Flocken')
  })

  it('meldet ungültige Codes, fehlende Namen und Doppelte mit Zeilennummer', () => {
    expect(() => buildBlsFile([header, row('X12', 'A', {})])).toThrow('Zeile 2: ungültiger BLS-Code')
    expect(() => buildBlsFile([header, row('1234567', 'A', {})])).toThrow('ungültiger BLS-Code')
    expect(() => buildBlsFile([header, oats, row('C141000', '', {})])).toThrow('Zeile 3: Name fehlt')
    expect(() => buildBlsFile([header, oats, oats])).toThrow('Zeile 3: BLS-Code C133000 doppelt')
  })

  it('nennt Zeile und Code bei kaputten Werten', () => {
    expect(() => buildBlsFile([header, row('C131000', 'Hafer', { FAT: 'k.A.' })])).toThrow(
      'Zeile 2 (C131000): Unbekannter BLS-Wert „k.A.“',
    )
  })

  it('bricht bei leerer Tabelle ab', () => {
    expect(() => buildBlsFile([])).toThrow('leer')
  })
})

describe('stringifyBlsFile', () => {
  it('ergibt gültiges JSON mit einer Zeile pro Lebensmittel', () => {
    const file = buildBlsFile([header, oats, row('C141000', 'Gerste', { FAT: '-' })])
    const json = stringifyBlsFile(file)
    expect(JSON.parse(json)).toEqual(file)
    expect(json.split('\n').filter((l) => l.startsWith('["'))).toHaveLength(2)
    expect(json).toContain('null')
  })
})

describe('public/bls.json', () => {
  it('passt zum Leser der App und enthält die echten Daten', async () => {
    const { readFileSync } = await import('node:fs')
    const { parseBlsFile } = await import('../src/logic/blsFoods.ts')
    const foods = parseBlsFile(JSON.parse(readFileSync(new URL('../public/bls.json', import.meta.url), 'utf8')))
    expect(foods.length).toBe(7140)
    const oats = foods.find((f) => f.code === 'C133000')
    expect(oats?.name).toBe('Hafer Flocken')
    expect(oats?.per100.kcal).toBe(348)
    expect(foods.find((f) => f.code === 'P355000')?.per100.fiber).toBeNull()
  })
})
