// Aktuelle Preise je Lebensmittel für Rezept und Mahlzeit; null, solange die Kostenauswertung aus ist oder lädt.
import { useMemo } from 'react'
import { getCostsEnabled } from '../../db/costs.ts'
import { useLiveQuery } from '../../db/live.ts'
import { priceLookup, type PriceSources, type UnitPriceLookup } from '../../logic/cost.ts'

export function usePriceLookup(sources: PriceSources | undefined): UnitPriceLookup | null {
  const enabled = useLiveQuery(getCostsEnabled, [])
  return useMemo(() => (enabled && sources ? priceLookup(sources) : null), [enabled, sources])
}
