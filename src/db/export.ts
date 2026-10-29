// Daten für den Export-Screen in einer Abfrage. Lädt alle Einträge und Gewichte, weil Zeitraum und Ebene im
// Screen frei wechseln; für eine persönliche App bleibt das klein (ein Jahr ≈ wenige Tausend Einträge).

import { priceLookup } from '../logic/cost.ts'
import type { ExportFeatures, ExportInput } from '../logic/export.ts'
import { getCostsEnabled } from './costs.ts'
import { db } from './db.ts'
import { getEstimateEnabled } from './weights.ts'
import type { LocalDate } from './types.ts'

export interface ExportData {
  /** alles außer dem Zeitraum, den der Screen setzt */
  input: Omit<ExportInput, 'range'>
  /** Erster Tag mit Einträgen oder Gewicht bis heute; null = noch keine Daten („Alles“) */
  firstDate: LocalDate | null
  /** Verbrauchsschätzung an: Spalte Gewicht wählbar; Kostenauswertung an: Spalte Kosten wählbar */
  features: ExportFeatures
}

export async function loadExportData(today: LocalDate): Promise<ExportData> {
  const [entries, days, slots, assignments, versions, weights] = await Promise.all([
    db.entries.filter((e) => e.deletedAt === null).toArray(),
    db.days.filter((d) => d.deletedAt === null && d.complete).toArray(),
    db.slots.toArray(),
    db.profileAssignments.toArray(),
    db.profileVersions.toArray(),
    db.weights.filter((w) => w.deletedAt === null).toArray(),
  ])
  const [weightEnabled, costEnabled, products, blsPrefs, recipes] = await Promise.all([
    getEstimateEnabled(),
    getCostsEnabled(),
    db.products.toArray(),
    db.blsPrefs.toArray(),
    db.recipes.toArray(),
  ])
  const firstDate =
    [...entries.map((e) => e.date), ...(weightEnabled ? weights.map((w) => w.date) : [])]
      .filter((d) => d <= today)
      .sort()[0] ?? null
  return {
    input: {
      entries,
      completeDates: new Set(days.map((d) => d.date)),
      slots,
      assignments,
      versions,
      // Ohne Verbrauchsschätzung gibt es keine Gewichte im Export
      weights: weightEnabled ? weights : [],
      prices: priceLookup({ products, blsPrefs, recipes }),
    },
    firstDate,
    features: { weight: weightEnabled, cost: costEnabled },
  }
}
