// Liest public/bls.json (erzeugt von scripts/build-bls.ts) in Lebensmittel mit Nutrients um.

import { z } from 'zod'
import { NUTRIENT_KEYS } from '../db/records.ts'
import type { Nutrients } from '../db/types.ts'

export interface BlsFood {
  code: string
  name: string
  per100: Nutrients
}

const value = z.number().nonnegative().nullable()
const fileSchema = z.object({
  source: z.string(),
  version: z.string(),
  fields: z.array(z.string()),
  rows: z.array(z.tuple([z.string(), z.string()], value)),
})

/** Prüft die Datei mit Zod und wandelt jede Zeile in ein BlsFood um */
export function parseBlsFile(json: unknown): BlsFood[] {
  const file = fileSchema.parse(json)
  const expected = ['code', 'name', ...NUTRIENT_KEYS]
  if (file.fields.join() !== expected.join()) {
    throw new Error(`bls.json hat unerwartete Felder: ${file.fields.join(', ')}`)
  }
  return file.rows.map(([code, name, ...values]) => {
    if (values.length !== NUTRIENT_KEYS.length) throw new Error(`bls.json: Zeile ${code} unvollständig`)
    const per100 = {} as Nutrients
    NUTRIENT_KEYS.forEach((key, i) => (per100[key] = values[i] ?? null))
    return { code, name, per100 }
  })
}
