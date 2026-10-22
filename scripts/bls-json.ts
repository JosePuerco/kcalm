// Wandelt die Zeilen der BLS-Excel in die kompakte JSON-Datei für die App um.
// Reine Funktionen ohne Dateizugriff, damit sie testbar sind (Aufruf: build-bls.ts).

export type Cell = string | number | boolean | Date | null | undefined

/** Reihenfolge der Nährwerte in jeder Zeile, gleich wie NUTRIENT_KEYS in src/db/records.ts */
export const BLS_NUTRIENTS = [
  'kcal',
  'fat',
  'satFat',
  'carbs',
  'sugar',
  'fiber',
  'protein',
  'salt',
] as const

/** Kürzel der Gehalt-Spalte in der Kopfzeile, z. B. „ENERCC Energie (Kilokalorien) [kcal/100g]“ */
const COLUMN_CODES: Record<(typeof BLS_NUTRIENTS)[number], string> = {
  kcal: 'ENERCC',
  fat: 'FAT',
  satFat: 'FASAT',
  carbs: 'CHO',
  sugar: 'SUGAR',
  fiber: 'FIBT',
  protein: 'PROT625',
  salt: 'NACL',
}

/** [Code, Name, kcal, fat, satFat, carbs, sugar, fiber, protein, salt] */
export type BlsRow = [string, string, ...(number | null)[]]

export interface BlsFile {
  source: string
  version: string
  fields: string[]
  rows: BlsRow[]
}

export const BLS_SOURCE =
  'Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 – Deutsche Nährstoffdatenbank. Karlsruhe. DOI: 10.25826/Data20251217-134202-0'

/** Spuren und Werte unter der Nachweis-/Bestimmungsgrenze: gemessen, verschwindend klein → 0 */
const BELOW_LIMIT = new Set(['TR', '<LOD', '<LOQ', '<LOD or <LOQ'])
/** Fehlender Wert laut BLS-Doku 4.3: „nicht als Null interpretieren“ → null */
const MISSING = new Set(['', '-'])

/** Auf 3 Nachkommastellen, entfernt Rechen-Rauschen wie 9.3000000000000007 */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

/** Ein Nährwert-Feld: Zahl, null (unbekannt) oder Fehler bei unbekanntem Inhalt */
export function parseNutrientCell(cell: Cell): number | null {
  if (cell === null || cell === undefined) return null
  let value: number
  if (typeof cell === 'number') {
    value = cell
  } else if (typeof cell === 'string') {
    const text = cell.trim()
    if (MISSING.has(text)) return null
    if (BELOW_LIMIT.has(text)) return 0
    if (!/^\d+([.,]\d+)?(E-?\d+)?$/i.test(text)) throw new Error(`Unbekannter BLS-Wert „${cell}“`)
    value = Number(text.replace(',', '.'))
  } else {
    throw new Error(`Unerwarteter BLS-Zelltyp: ${String(cell)}`)
  }
  if (!Number.isFinite(value) || value < 0) throw new Error(`Ungültiger BLS-Wert ${value}`)
  return round3(value)
}

/** Spaltennummern aus der Kopfzeile: Code, Name und je Nährwert die Gehalt-Spalte */
export function findColumns(header: Cell[]): { code: number; name: number; nutrients: number[] } {
  const titles = header.map((c) => (typeof c === 'string' ? c.trim() : ''))
  const find = (test: (t: string) => boolean, label: string) => {
    const index = titles.findIndex(test)
    if (index === -1) throw new Error(`BLS-Spalte „${label}“ fehlt`)
    return index
  }
  return {
    code: find((t) => t === 'BLS Code', 'BLS Code'),
    name: find((t) => t === 'Lebensmittelbezeichnung', 'Lebensmittelbezeichnung'),
    // Gehalt-Spalte = Kürzel + Einheit in Klammern; „… Datenherkunft“ und „… Referenz“ fallen raus
    nutrients: BLS_NUTRIENTS.map((key) => {
      const code = COLUMN_CODES[key]
      return find((t) => t.startsWith(`${code} `) && t.endsWith('/100g]'), code)
    }),
  }
}

/** Ganze Tabelle (erste Zeile = Kopf) → BlsFile */
export function buildBlsFile(sheet: Cell[][]): BlsFile {
  const [header, ...body] = sheet
  if (!header) throw new Error('BLS-Tabelle ist leer')
  const cols = findColumns(header)
  const seen = new Set<string>()
  const rows: BlsRow[] = []

  body.forEach((cells, i) => {
    const line = i + 2 // Excel-Zeilennummer
    if (cells.every((c) => c === null || c === undefined || c === '')) return
    const code = String(cells[cols.code] ?? '').trim()
    const name = String(cells[cols.name] ?? '').trim()
    // Buchstabe + 6 Ziffern/Großbuchstaben, z. B. C133000, M5B1600
    if (!/^[A-Z][0-9A-Z]{6}$/.test(code)) throw new Error(`Zeile ${line}: ungültiger BLS-Code „${code}“`)
    if (!name) throw new Error(`Zeile ${line}: Name fehlt`)
    if (seen.has(code)) throw new Error(`Zeile ${line}: BLS-Code ${code} doppelt`)
    seen.add(code)
    try {
      rows.push([code, name, ...cols.nutrients.map((c) => parseNutrientCell(cells[c]))])
    } catch (error) {
      throw new Error(`Zeile ${line} (${code}): ${(error as Error).message}`, { cause: error })
    }
  })

  return { source: BLS_SOURCE, version: '4.0', fields: ['code', 'name', ...BLS_NUTRIENTS], rows }
}

/** JSON mit einer Zeile pro Lebensmittel: kompakt, aber lesbare Git-Diffs */
export function stringifyBlsFile(file: BlsFile): string {
  const { rows, ...head } = file
  const meta = JSON.stringify(head).slice(0, -1)
  return `${meta},"rows":[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]}\n`
}
