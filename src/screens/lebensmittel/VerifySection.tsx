// Verifizieren nach Produkt.dc.html: Karte „Nährwerte pro 100 g“ mit Tabelle Original · Meine und
// markierten Abweichungen, darunter „Werte bearbeiten“ und Prüfen. Für OFF-Produkte und BLS-Lebensmittel;
// eigene Produkte bearbeiten ihre Werte direkt. Meine Werte gelten immer, das Original steht zum Vergleich
// daneben; den Umschalter Meine/Original aus dem Prototyp gibt es nicht mehr (Jan, 29.10.2026).
import { useState } from 'react'
import { IconCheck } from '../../components/icons/icons.tsx'
import { Badge } from '../../components/ui/SubScreen.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import type { FoodRef, Nutrients, ProductOverride, Unit } from '../../db/types.ts'
import { setVerified } from '../../db/verify.ts'
import { formatDate } from '../../logic/format.ts'
import { formatNutrient, NUTRIENT_INFO } from '../../logic/nutrientInfo.ts'
import { canVerify, compareRows, countCorrected, mergeNutrients, missingForVerify } from '../../logic/verify.ts'

/** Badge Prüfstatus: „Geprüft am 12.10.2026“ bzw. „Nicht geprüft“ */
export function VerifiedBadge({ override }: { override: ProductOverride | undefined }) {
  if (!override?.verifiedAt) return <Badge>Nicht geprüft</Badge>
  return (
    <Badge tone="accent">
      <IconCheck size={12} strokeWidth={2.6} />
      Geprüft am {formatDate(new Date(override.verifiedAt))}
    </Badge>
  )
}

type Props = {
  foodRef: FoodRef
  original: Nutrients
  override: ProductOverride | undefined
  unit: Unit
  editHref: string
  /** Satz am Ende der Fußnote, z. B. Quelle */
  note: string
}

export function VerifySection({ foodRef, original, override, unit, editHref, note }: Props) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const rows = compareRows(original, override)
  const corrected = countCorrected(original, override)
  const mine = mergeNutrients(original, override)
  const missing = missingForVerify(mine)
  const verified = !!override?.verifiedAt

  const run = async (action: () => Promise<void>, done?: string) => {
    setBusy(true)
    try {
      await action()
      if (done) toast(done)
    } catch (error) {
      console.error(error)
      toast('Das hat nicht geklappt')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card className="pt-3.5 pb-1.5">
        <div className="flex items-center justify-between pb-2">
          <h2 className="text-body font-semibold">Nährwerte pro 100 {unit}</h2>
          <span className="text-small text-muted">{corrected} korrigiert</span>
        </div>
        <div className="text-small text-muted grid grid-cols-[minmax(0,1fr)_76px_76px] pt-1.5 pb-1">
          <span />
          <span className="pr-2 text-right">Original</span>
          <span className="pr-2 text-right">Meine</span>
        </div>
        {rows.map((r) => {
          const info = NUTRIENT_INFO[r.key]
          return (
            <div key={r.key} className="border-line text-label grid min-h-10 grid-cols-[minmax(0,1fr)_76px_76px] items-center border-t">
              <span className={info.sub ? 'text-muted pl-3' : ''}>{info.label}</span>
              <Cell value={formatNutrient(r.key, r.original)} active={false} differs={r.differs} />
              <Cell value={formatNutrient(r.key, r.mine)} active differs={r.differs} mine />
            </div>
          )
        })}
        <p className="text-small text-muted py-2 leading-[1.4]">
          Es gelten deine Werte, das Original steht zum Vergleich daneben. „–“ heißt unbekannt, nicht 0. {note}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={editHref}
          className="press bg-card rounded-field text-label flex min-h-12 items-center justify-center font-semibold"
        >
          Werte bearbeiten
        </a>
        {verified ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => setVerified(foodRef, original, false), 'Prüfung entfernt')}
            className="press bg-card rounded-field text-label flex min-h-12 items-center justify-center text-center font-semibold"
          >
            Prüfung entfernen
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || !canVerify(mine)}
            onClick={() => void run(() => setVerified(foodRef, original, true), 'Als geprüft markiert')}
            className="press bg-accent text-on-accent rounded-field text-label flex min-h-12 items-center justify-center text-center font-semibold disabled:opacity-40"
          >
            Als geprüft markieren
          </button>
        )}
      </div>
      {!verified && missing.length > 0 && (
        <p className="text-small text-muted px-1 leading-[1.45]">
          Zum Prüfen fehlt noch: {missing.map((k) => NUTRIENT_INFO[k].label).join(', ')}
        </p>
      )}
    </>
  )
}

type CellProps = { value: string; active: boolean; differs: boolean; mine?: boolean }

/** Genutzte Spalte normal, die andere muted; Abweichung in der genutzten Spalte auf accentSoft */
function Cell({ value, active, differs, mine = false }: CellProps) {
  const marked = active && differs
  const color = !active ? 'text-muted' : marked && mine ? 'text-accent-text font-semibold' : 'text-text'
  return (
    <span
      className={`rounded-segment-item px-2 py-1 text-right transition-colors duration-200 ${
        marked ? 'bg-accent-soft' : ''
      } ${color}`}
    >
      {value}
    </span>
  )
}
