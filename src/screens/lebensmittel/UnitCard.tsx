// Einheit g/ml bei OFF-Produkten und BLS-Lebensmitteln (Phase 12e, kein Prototyp): Zeile wie „Einheit“
// im Produktformular. Gespeichert in der Korrekturschicht; alte Einträge bekommen die Einheit auch.
import { Card } from '../../components/ui/Card.tsx'
import { Segmented } from '../../components/ui/Segmented.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import type { FoodRef, Unit } from '../../db/types.ts'
import { setUnit } from '../../db/verify.ts'

const UNITS = [
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
] as const

type Props = {
  foodRef: FoodRef
  /** Einheit des Originals (OFF bzw. g bei BLS) */
  original: Unit
  /** aktuell gültige Einheit */
  unit: Unit
}

export function UnitCard({ foodRef, original, unit }: Props) {
  const toast = useToast()
  const change = async (chosen: Unit) => {
    try {
      await setUnit(foodRef, original, chosen)
    } catch (error) {
      console.error(error)
      toast('Das hat nicht geklappt')
    }
  }
  return (
    <Card padded={false} className="px-card-padding">
      <div className="text-label flex min-h-14 items-center justify-between gap-3 py-2">
        <span>Einheit</span>
        <div className="w-32 shrink-0">
          <Segmented label="Einheit" inCard options={UNITS} value={unit} onChange={(u: Unit) => void change(u)} />
        </div>
      </div>
    </Card>
  )
}
