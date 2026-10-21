// Produktdetail nach Produkt.dc.html. OFF-Produkte: Original gegen Meine Werte (Verifizieren)
// und „Original jetzt aktualisieren“; eigene Produkte: eine Spalte, Werte direkt bearbeiten.
import { useState } from 'react'
import { href, navigate } from '../../app/router.ts'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { Badge, SubScreen, SubScreenTitle } from '../../components/ui/SubScreen.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { db } from '../../db/db.ts'
import { useLiveQuery } from '../../db/live.ts'
import { refreshOffProduct, type OffRefresh } from '../../db/off.ts'
import {
  archiveProduct,
  deleteProduct,
  isFoodUsed,
  restoreProduct,
  saveProductPortions,
} from '../../db/products.ts'
import { getOverride } from '../../db/verify.ts'
import { SOURCE_LABEL } from '../../logic/foodList.ts'
import { formatDate } from '../../logic/format.ts'
import { NutrientTable } from './NutrientTable.tsx'
import { PortionsCard } from './PortionsCard.tsx'
import { VerifiedBadge, VerifySection } from './VerifySection.tsx'

const REFRESH_MESSAGE: Record<OffRefresh['kind'], string> = {
  updated: 'Original aktualisiert',
  notFound: 'Nicht mehr bei Open Food Facts',
  noNutrients: 'Open Food Facts hat keine Nährwerte mehr, Original bleibt',
  offline: 'Kein Internet',
  unreachable: 'Open Food Facts nicht erreichbar',
}

const LIST = href('lebensmittel')

export function ProductDetail({ id }: { id: string }) {
  const toast = useToast()
  // null = nicht (mehr) vorhanden, undefined = lädt
  const product = useLiveQuery(async () => {
    const p = await db.products.get(id)
    return p && p.deletedAt === null ? p : null
  }, [id])
  const used = useLiveQuery(() => isFoodUsed(`product:${id}`), [id])
  // null = keine Korrektur
  const override = useLiveQuery(async () => (await getOverride(`product:${id}`)) ?? null, [id])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  if (product === undefined || override === undefined) return <SubScreen back={LIST} />
  if (product === null) {
    return (
      <SubScreen back={LIST}>
        <SubScreenTitle title="Nicht gefunden" meta="Dieses Produkt gibt es nicht mehr." />
      </SubScreen>
    )
  }

  const run = async (action: () => Promise<void>, done: string) => {
    try {
      await action()
      toast(done)
    } catch (error) {
      console.error(error)
      toast('Das hat nicht geklappt')
    }
  }

  const meta = [product.brand, product.barcode && `EAN ${product.barcode}`].filter(Boolean).join(' · ')
  const isOff = product.source === 'off'

  const refresh = async () => {
    setRefreshing(true)
    try {
      toast(REFRESH_MESSAGE[(await refreshOffProduct(id)).kind])
    } catch (error) {
      console.error(error)
      toast('Das hat nicht geklappt')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <SubScreen back={LIST}>
      <SubScreenTitle title={product.name} meta={meta || undefined}>
        <Badge>{SOURCE_LABEL[product.source]}</Badge>
        {isOff && <VerifiedBadge override={override ?? undefined} />}
        {product.archived && <Badge>Archiviert</Badge>}
      </SubScreenTitle>

      {isOff ? (
        <VerifySection
          foodRef={`product:${id}`}
          original={product.per100}
          override={override ?? undefined}
          useOverride={product.useOverride}
          unit={product.unit}
          editHref={href('lebensmittel', 'produkt', id, 'bearbeiten')}
          note="Ein Update aus Open Food Facts ändert nur die Original-Spalte."
        />
      ) : (
        <NutrientTable per100={product.per100} unit={product.unit} />
      )}

      {!isOff && (
        <a
          href={href('lebensmittel', 'produkt', id, 'bearbeiten')}
          className="press bg-card rounded-field text-label flex min-h-12 items-center justify-center font-semibold"
        >
          Werte bearbeiten
        </a>
      )}

      <PortionsCard
        portions={product.portions}
        unit={product.unit}
        onSave={(portions) => saveProductPortions(id, portions)}
      />

      <Card padded={false} className="px-card-padding py-1">
        <div className="text-label flex min-h-12 items-center justify-between">
          <span>Ist ein Getränk</span>
          <span className="text-muted">{product.isDrink ? 'Ja' : 'Nein'}</span>
        </div>
        {isOff && (
          <>
            <div className="border-line text-label flex min-h-12 items-center justify-between gap-3 border-t">
              <span>Zuletzt aus Open Food Facts geladen</span>
              <span className="text-muted">{product.offFetchedAt ? formatDate(new Date(product.offFetchedAt)) : '–'}</span>
            </div>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void refresh()}
              className="border-line text-label text-accent-text min-h-12 w-full border-t font-medium disabled:opacity-40"
            >
              {refreshing ? 'Wird aktualisiert …' : 'Original jetzt aktualisieren'}
            </button>
          </>
        )}
      </Card>

      {product.archived ? (
        <Button variant="text" className="text-label justify-center font-medium" onClick={() => void run(() => restoreProduct(id), 'Wiederhergestellt')}>
          Wiederherstellen
        </Button>
      ) : used ? (
        // Im Tagebuch verwendet: nur archivieren (PLAN.md 2, Produkte)
        <Button
          variant="text"
          className="text-label text-warn-text justify-center font-medium"
          onClick={() => void run(() => archiveProduct(id), 'Archiviert')}
        >
          Archivieren
        </Button>
      ) : (
        <Button
          variant="text"
          className="text-label text-danger justify-center font-medium"
          onClick={() => {
            // Zweiter Tipp bestätigt, kein Popup
            if (!confirmDelete) return setConfirmDelete(true)
            void run(async () => {
              await deleteProduct(id)
              navigate(LIST, { replace: true })
            }, 'Gelöscht')
          }}
        >
          {confirmDelete ? 'Wirklich löschen? Nochmal tippen' : 'Löschen'}
        </Button>
      )}
    </SubScreen>
  )
}
