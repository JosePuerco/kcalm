// BLS-Lebensmittel nach Produkt.dc.html: Original gegen Meine Werte (Korrekturschicht),
// eigene Portionen und der Umschalter Meine/Original in blsPrefs.
import { href } from '../../app/router.ts'
import { Badge, SubScreen, SubScreenTitle } from '../../components/ui/SubScreen.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { useBls } from '../../data/bls.ts'
import { useLiveQuery } from '../../db/live.ts'
import { getBlsPref, saveBlsPortions } from '../../db/products.ts'
import { getOverride } from '../../db/verify.ts'
import { effectiveUnit } from '../../logic/verify.ts'
import { PortionsCard } from './PortionsCard.tsx'
import { UnitCard } from './UnitCard.tsx'
import { VerifiedBadge, VerifySection } from './VerifySection.tsx'

const LIST = href('lebensmittel')

export function BlsDetail({ code }: { code: string }) {
  const toast = useToast()
  const bls = useBls()
  // null = noch keine eigene Einstellung
  const pref = useLiveQuery(async () => (await getBlsPref(code)) ?? null, [code])
  // null = keine Korrektur
  const override = useLiveQuery(async () => (await getOverride(`bls:${code}`)) ?? null, [code])

  if (bls.status === 'loading' || pref === undefined || override === undefined) return <SubScreen back={LIST} />
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

  // BLS gilt pro 100 g; ml nur, wenn selbst gewählt (Phase 12e)
  const unit = effectiveUnit('g', override ?? undefined)

  return (
    <SubScreen back={LIST}>
      <SubScreenTitle title={food.name} meta={`BLS-Code ${food.code}`}>
        <Badge>BLS</Badge>
        <VerifiedBadge override={override ?? undefined} />
      </SubScreenTitle>

      <VerifySection
        foodRef={`bls:${code}`}
        original={food.per100}
        override={override ?? undefined}
        useOverride={pref?.useOverride ?? true}
        unit={unit}
        editHref={href('lebensmittel', 'bls', code, 'bearbeiten')}
        note="Quelle: Max Rubner-Institut, BLS 4.0."
      />

      <UnitCard foodRef={`bls:${code}`} original="g" unit={unit} />

      <PortionsCard
        portions={pref?.portions ?? []}
        unit={unit}
        onSave={async (portions) => {
          await saveBlsPortions(code, portions)
          if (portions.length > 0 && (pref?.portions.length ?? 0) === 0) toast('Steht jetzt in deinen Lebensmitteln')
        }}
      />
    </SubScreen>
  )
}
