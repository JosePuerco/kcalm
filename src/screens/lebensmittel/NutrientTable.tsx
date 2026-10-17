// Karte „Nährwerte pro 100 g“ nach Produkt.dc.html, in Phase 1 nur mit einer Spalte
// (Original gegen Meine Werte kommt mit dem Verifizieren in Phase 6).
import { Card } from '../../components/ui/Card.tsx'
import type { NutrientKey, Nutrients, Unit } from '../../db/types.ts'
import { formatNutrient, MAIN_NUTRIENTS, MORE_NUTRIENTS, NUTRIENT_INFO } from '../../logic/nutrientInfo.ts'

type Props = { per100: Nutrients; unit: Unit; note?: string }

export function NutrientTable({ per100, unit, note }: Props) {
  // Wasser und Alkohol nur zeigen, wenn bekannt
  const keys: NutrientKey[] = [...MAIN_NUTRIENTS, ...MORE_NUTRIENTS.filter((k) => per100[k] !== null)]
  return (
    <Card className="pt-3.5 pb-1.5">
      <h2 className="text-body pb-2 font-semibold">Nährwerte pro 100 {unit}</h2>
      {keys.map((key) => {
        const info = NUTRIENT_INFO[key]
        return (
          <div key={key} className="border-line text-label flex min-h-10 items-center border-t">
            <span className={`flex-1 ${info.sub ? 'text-muted pl-3' : ''}`}>{info.label}</span>
            <span className="pr-2 text-right">{formatNutrient(key, per100[key])}</span>
          </div>
        )
      })}
      <p className="text-small text-muted py-2 leading-[1.4]">„–“ heißt unbekannt, nicht 0.{note ? ` ${note}` : ''}</p>
    </Card>
  )
}
