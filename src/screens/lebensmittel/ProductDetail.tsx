// Produktdetail nach Produkt.dc.html, Phase-1-Fassung: ohne Verifizieren (Phase 6)
// und ohne OFF-Aktualisierung (Phase 4).
import { useState } from 'react'
import { href, navigate } from '../../app/router.ts'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { Badge, SubScreen, SubScreenTitle } from '../../components/ui/SubScreen.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { db } from '../../db/db.ts'
import { useLiveQuery } from '../../db/live.ts'
import {
  archiveProduct,
  deleteProduct,
  isFoodUsed,
  restoreProduct,
  saveProductPortions,
} from '../../db/products.ts'
import { SOURCE_LABEL } from '../../logic/foodList.ts'
import { NutrientTable } from './NutrientTable.tsx'
import { PortionsCard } from './PortionsCard.tsx'

const LIST = href('lebensmittel')

export function ProductDetail({ id }: { id: string }) {
  const toast = useToast()
  // null = nicht (mehr) vorhanden, undefined = lädt
  const product = useLiveQuery(async () => {
    const p = await db.products.get(id)
    return p && p.deletedAt === null ? p : null
  }, [id])
  const used = useLiveQuery(() => isFoodUsed(`product:${id}`), [id])
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (product === undefined) return <SubScreen back={LIST} />
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

  return (
    <SubScreen back={LIST}>
      <SubScreenTitle title={product.name} meta={meta || undefined}>
        <Badge>{SOURCE_LABEL[product.source]}</Badge>
        {product.archived && <Badge>Archiviert</Badge>}
      </SubScreenTitle>

      <NutrientTable per100={product.per100} unit={product.unit} />

      <a
        href={href('lebensmittel', 'produkt', id, 'bearbeiten')}
        className="press bg-card rounded-field text-label flex min-h-12 items-center justify-center font-semibold"
      >
        Werte bearbeiten
      </a>

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
