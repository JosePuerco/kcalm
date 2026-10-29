// Mahlzeit anlegen und bearbeiten. Kein Prototyp: aufgebaut wie Rezept.dc.html ohne Endgewicht (mit Jan
// abgestimmt): Abbrechen / Titel / Sichern, Name, Bestandteile mit Menge und kcal, „+ Bestandteil“, Summe.
// Rezepte dürfen Bestandteil sein. Beim Bearbeiten unten Archivieren und Löschen.
import { useState } from 'react'
import { href, navigate } from '../../app/router.ts'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { SubScreen, SubScreenTitle } from '../../components/ui/SubScreen.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { useBls } from '../../data/bls.ts'
import { db } from '../../db/db.ts'
import { loadFoodSources } from '../../db/entries.ts'
import { useLiveQuery } from '../../db/live.ts'
import { archiveMeal, createMeal, deleteMeal, restoreMeal, updateMeal } from '../../db/meals.ts'
import type { Meal } from '../../db/types.ts'
import { costText, itemsCost, missingPrices } from '../../logic/cost.ts'
import { formatSum } from '../../logic/diary.ts'
import { formatAmount, formatNumber } from '../../logic/format.ts'
import { mealKcal, partCount, validateMeal, type MealFormData } from '../../logic/meal.ts'
import { nutrientsForAmount } from '../../logic/nutrients.ts'
import { useFoodResolver } from '../add/useFoodResolver.ts'
import { CostCard } from './CostCard.tsx'
import { FoodPickerSheet } from './FoodPickerSheet.tsx'
import { usePriceLookup } from './usePriceLookup.ts'

const LIST = href('lebensmittel')

export function MealForm({ id }: { id?: string }) {
  // null = nicht (mehr) vorhanden, undefined = lädt
  const existing = useLiveQuery(async () => {
    if (!id) return null
    const m = await db.meals.get(id)
    return m && m.deletedAt === null ? m : null
  }, [id])

  if (id && existing === undefined) return <SubScreen back={LIST} />
  if (id && !existing) {
    return (
      <SubScreen back={LIST}>
        <SubScreenTitle title="Nicht gefunden" meta="Diese Mahlzeit gibt es nicht mehr." />
      </SubScreen>
    )
  }
  // Startwerte nur einmal übernehmen; spätere Datenbank-Änderungen überschreiben die Eingaben nicht
  return <MealBody key={id ?? 'neu'} meal={existing ?? null} />
}

/** null = Sheet zu, 'new' = Bestandteil hinzufügen, Zahl = Index des geänderten Bestandteils */
type Picking = null | 'new' | number

function MealBody({ meal }: { meal: Meal | null }) {
  const toast = useToast()
  const sources = useLiveQuery(loadFoodSources, [])
  const bls = useBls()
  const blsData = bls.status === 'ready' ? bls.data : null
  const resolver = useFoodResolver(sources, blsData)
  const prices = usePriceLookup(sources)

  const [values, setValues] = useState<MealFormData>(() =>
    meal ? { name: meal.name, items: meal.items } : { name: '', items: [] },
  )
  const [picking, setPicking] = useState<Picking>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const lines = values.items.map((item) => ({ item, food: resolver.resolve(item.ref) }))
  const total = mealKcal(values, resolver.resolve)
  const check = validateMeal(values)
  const editLine = typeof picking === 'number' ? lines[picking] : undefined
  const unknownName = bls.status === 'loading' ? 'Wird geladen …' : 'Unbekanntes Lebensmittel'

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true)
    try {
      await action()
      toast(done)
    } catch (error) {
      console.error(error)
      toast('Das hat nicht geklappt')
      setBusy(false)
    }
  }

  const save = () => {
    if (!check.ok) return
    void run(async () => {
      if (meal) await updateMeal(meal.id, check.data)
      else await createMeal(check.data)
      navigate(LIST, { replace: true })
    }, 'Gespeichert')
  }

  return (
    <>
      <header className="pt-safe-header flex shrink-0 items-center justify-between pr-2 pl-1">
        <a href={LIST} className="text-accent-text text-body-large flex min-h-touch-min items-center px-3">
          Abbrechen
        </a>
        <h1 className="text-sheet-title truncate">{meal ? 'Mahlzeit' : 'Neue Mahlzeit'}</h1>
        <button
          type="button"
          disabled={!check.ok || busy}
          onClick={save}
          className="press text-accent-text text-body-large flex min-h-touch-min items-center px-3 font-semibold disabled:opacity-40"
        >
          Sichern
        </button>
      </header>

      <main className="scroll-area px-screen-x gap-card-gap flex flex-col pt-2 pb-[calc(24px+env(safe-area-inset-bottom))]">
        <label className="bg-card rounded-field flex min-h-[52px] items-center px-4">
          <span className="sr-only">Name</span>
          <input
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            placeholder="Name der Mahlzeit"
            autoComplete="off"
            enterKeyHint="done"
            className="text-sheet-title placeholder:text-muted min-w-0 flex-1 bg-transparent outline-none placeholder:font-normal"
          />
        </label>

        <Card padded={false}>
          <div className="flex min-h-12 items-center justify-between pr-2 pl-4">
            <h2 className="text-body font-semibold">Bestandteile</h2>
            <Button variant="text" className="text-label" onClick={() => setPicking('new')}>
              + Bestandteil
            </Button>
          </div>
          {lines.length === 0 && (
            <p className="border-line text-label text-muted flex min-h-12 items-center border-t px-4">
              Noch keine Bestandteile. Mengen sind die Standardmengen.
            </p>
          )}
          {lines.map((l, i) => (
            <button
              key={`${l.item.ref}-${i}`}
              type="button"
              disabled={!l.food}
              onClick={() => setPicking(i)}
              className="border-line text-label flex min-h-12 w-full items-center gap-2 border-t px-4 text-left"
            >
              <span className="min-w-0 flex-1 truncate">{l.food?.name ?? unknownName}</span>
              <span className="text-muted min-w-[54px] text-right whitespace-nowrap">
                {formatAmount(l.item.amount)} {l.item.unit}
              </span>
              <span className="text-muted min-w-[66px] text-right whitespace-nowrap">
                {formatNumber(l.food ? nutrientsForAmount(l.food.per100, l.item.amount).kcal : null)} kcal
              </span>
            </button>
          ))}
          {lines.length > 0 && (
            <div className="border-line text-label flex min-h-[46px] items-center justify-between border-t px-4">
              <span className="text-muted">{partCount(lines.length)}</span>
              <span className="font-semibold">{formatSum(total)} kcal</span>
            </div>
          )}
        </Card>

        {prices && values.items.length > 0 && (
          <CostCard
            rows={[{ label: 'Ganze Mahlzeit', value: costText(itemsCost(values.items, prices)) }]}
            missing={missingPrices(values.items, prices).map((ref) => resolver.resolve(ref)?.name ?? unknownName)}
          />
        )}

        <p className="text-small text-muted px-1 leading-[1.45]">
          Beim Eintragen kannst du Bestandteile abwählen, Mengen anpassen und alles skalieren. Die Vorlage bleibt
          dabei gleich.
        </p>
        {meal && (
          <p className="text-small text-muted px-1 leading-[1.45]">
            Änderungen gelten nur für künftige Einträge. Was schon im Tagebuch steht, bleibt gleich.
          </p>
        )}
        {!check.ok && (values.name !== '' || values.items.length > 0) && (
          <p className="text-small text-muted px-1 leading-[1.45]">Zum Sichern fehlt noch: {check.error}</p>
        )}

        {meal && (
          <>
            {meal.archived ? (
              <Button
                variant="text"
                className="text-label justify-center font-medium"
                disabled={busy}
                onClick={() => void run(() => restoreMeal(meal.id), 'Wiederhergestellt')}
              >
                Wiederherstellen
              </Button>
            ) : (
              <Button
                variant="text"
                className="text-label text-warn-text justify-center font-medium"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await archiveMeal(meal.id)
                    navigate(LIST, { replace: true })
                  }, 'Archiviert')
                }
              >
                Archivieren
              </Button>
            )}
            {/* Einträge tragen Werte und Namen selbst: Löschen ist immer möglich */}
            <Button
              variant="text"
              className="text-label text-danger justify-center font-medium"
              disabled={busy}
              onClick={() => {
                // Zweiter Tipp bestätigt, kein Popup
                if (!confirmDelete) return setConfirmDelete(true)
                void run(async () => {
                  await deleteMeal(meal.id)
                  navigate(LIST, { replace: true })
                }, 'Gelöscht')
              }}
            >
              {confirmDelete ? 'Wirklich löschen? Nochmal tippen' : 'Löschen'}
            </Button>
          </>
        )}
      </main>

      <FoodPickerSheet
        open={picking !== null}
        onClose={() => setPicking(null)}
        title={picking === 'new' ? 'Bestandteil hinzufügen' : 'Bestandteil'}
        editing={
          editLine?.food ? { food: editLine.food, amount: editLine.item.amount, portionLabel: editLine.item.portionLabel } : null
        }
        sources={sources}
        bls={blsData}
        resolver={resolver}
        confirmLabel={picking === 'new' ? 'Zur Mahlzeit hinzufügen' : 'Übernehmen'}
        onConfirm={(food, amount, portionLabel) => {
          const item = { ref: food.ref, amount, unit: food.unit, portionLabel }
          setValues((v) => ({
            ...v,
            items: typeof picking === 'number' ? v.items.map((it, i) => (i === picking ? item : it)) : [...v.items, item],
          }))
        }}
        onRemove={() => setValues((v) => ({ ...v, items: v.items.filter((_, i) => i !== picking) }))}
      />
    </>
  )
}
