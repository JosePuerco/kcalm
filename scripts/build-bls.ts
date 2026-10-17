// Erzeugt public/bls.json aus data/bls/BLS_4_0_Daten_2025_DE.xlsx.
// Läuft nur von Hand (npm run bls), weil die Excel nicht im Repo liegt; das Ergebnis wird committet.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readSheet } from 'read-excel-file/node'
import { buildBlsFile, stringifyBlsFile, type Cell } from './bls-json.ts'

const root = new URL('../', import.meta.url)
const source = fileURLToPath(new URL('data/bls/BLS_4_0_Daten_2025_DE.xlsx', root))
const target = new URL('public/bls.json', root)

const sheet = (await readSheet(source)) as Cell[][]
const file = buildBlsFile(sheet)
const json = stringifyBlsFile(file)
writeFileSync(target, json)

const unknown = file.rows.reduce((n, row) => n + row.filter((v) => v === null).length, 0)
console.log(`bls.json: ${file.rows.length} Lebensmittel, ${unknown} unbekannte Werte, ${Math.round(json.length / 1024)} KB`)
