// Karte „Kosten“ für Rezept und Mahlzeit (Phase 13, kein Prototyp): Zeilen wie die Summe unter den Zutaten,
// darunter, bei welchen Zutaten der Preis fehlt. Nur bei aktiver Kostenauswertung.
import { Card } from '../../components/ui/Card.tsx'

type Props = {
  rows: readonly { label: string; value: string }[]
  /** Namen der Zutaten bzw. Bestandteile ohne Preis */
  missing: readonly string[]
}

export function CostCard({ rows, missing }: Props) {
  return (
    <Card padded={false} className="px-card-padding py-1">
      <h2 className="text-body flex min-h-12 items-center font-semibold">Kosten</h2>
      {rows.map((r) => (
        <div key={r.label} className="border-line text-label flex min-h-touch-min items-center justify-between gap-3 border-t">
          <span className="text-muted min-w-0 truncate">{r.label}</span>
          <span className="font-semibold whitespace-nowrap">{r.value}</span>
        </div>
      ))}
      {missing.length > 0 && (
        <p className="border-line text-small text-muted border-t py-2.5 leading-[1.45]">
          Preis fehlt bei: {missing.join(', ')}
        </p>
      )}
    </Card>
  )
}
