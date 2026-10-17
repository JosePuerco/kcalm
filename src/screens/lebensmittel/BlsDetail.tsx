// BLS-Lebensmittel: Werte nur lesen (Korrektur kommt mit dem Verifizieren in Phase 6),
// eigene Portionen und „Ist ein Getränk“ in blsPrefs.
import { href } from '../../app/router.ts'
import { Card } from '../../components/ui/Card.tsx'
import { Badge, SubScreen, SubScreenTitle } from '../../components/ui/SubScreen.tsx'
import { Switch } from '../../components/ui/Switch.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { useBls } from '../../data/bls.ts'
import { useLiveQuery } from '../../db/live.ts'
import { getBlsPref, saveBlsPortions, setBlsIsDrink } from '../../db/products.ts'
import { NutrientTable } from './NutrientTable.tsx'
import { PortionsCard } from './PortionsCard.tsx'

const LIST = href('lebensmittel')

export function BlsDetail({ code }: { code: string }) {
  const toast = useToast()
  const bls = useBls()
  // null = noch keine eigene Einstellung
  const pref = useLiveQuery(async () => (await getBlsPref(code)) ?? null, [code])

  if (bls.status === 'loading' || pref === undefined) return <SubScreen back={LIST} />
  const food = bls.status === 'ready' ? bls.data.byCode.get(code) : undefined
  if (!food) {
    return (
      <SubScreen back={LIST}>
        <SubScreenTitle
          title="Nicht gefunden"
          meta={bls.status === 'error' ? 'Die BLS-Daten konnten nicht geladen werden.' : `BLS-Code ${code} gibt es nicht.`}
        />
      </SubScreen>
    )
  }

  return (
    <SubScreen back={LIST}>
      <SubScreenTitle title={food.name} meta={`BLS-Code ${food.code}`}>
        <Badge>BLS</Badge>
      </SubScreenTitle>

      <NutrientTable per100={food.per100} unit="g" note="Quelle: Max Rubner-Institut, BLS 4.0." />

      <PortionsCard
        portions={pref?.portions ?? []}
        unit="g"
        onSave={async (portions) => {
          await saveBlsPortions(code, portions)
          if (portions.length > 0 && (pref?.portions.length ?? 0) === 0) toast('Steht jetzt in deinen Lebensmitteln')
        }}
      />

      <Card padded={false} className="px-card-padding py-1">
        <div className="text-label flex min-h-12 items-center justify-between gap-3">
          <span>Ist ein Getränk</span>
          <Switch
            label="Ist ein Getränk"
            checked={pref?.isDrink ?? false}
            onChange={(checked) => {
              setBlsIsDrink(code, checked).catch((error: unknown) => {
                console.error(error)
                toast('Das hat nicht geklappt')
              })
            }}
          />
        </div>
      </Card>
    </SubScreen>
  )
}
