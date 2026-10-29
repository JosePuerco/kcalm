// Rezept anlegen und bearbeiten nach Rezept.dc.html: Abbrechen / Titel / Sichern, Name, Zutaten roh mit Summe,
// Endgewicht mit −/+ (Tipp auf die Zahl öffnet den Ziffernblock), Kochverlust, Karte „Pro 100 g fertig“.
// Ergänzungen (mit Jan abgestimmt): Endgewicht beginnt leer, „Sichern“ bleibt bis dahin grau; Portionen als eigene
// Karte mit kcal je Portion; beim Bearbeiten unten Archivieren bzw. Löschen.
import { useState } from 'react'
import { href, navigate } from '../../app/router.ts'
import { IconMinus, IconPlus } from '../../components/icons/icons.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { Keypad } from '../../components/ui/Keypad.tsx'
import { Sheet } from '../../components/ui/Sheet.tsx'
import { SubScreen, SubScreenTitle } from '../../components/ui/SubScreen.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { useBls } from '../../data/bls.ts'
import { db } from '../../db/db.ts'
import { loadFoodSources } from '../../db/entries.ts'
import { useLiveQuery } from '../../db/live.ts'
import { isFoodUsed } from '../../db/products.ts'
import { archiveRecipe, createRecipe, deleteRecipe, restoreRecipe, updateRecipe } from '../../db/recipes.ts'
import type { Recipe } from '../../db/types.ts'
import { amountToKeypad, type FoodChoice } from '../../logic/addFood.ts'
import { costText, formatEuro, itemsCost, missingPrices, recipeUnitPrice } from '../../logic/cost.ts'
import { formatSum } from '../../logic/diary.ts'
import { formatAmount, formatNumber } from '../../logic/format.ts'
import { parseKeypadValue } from '../../logic/keypad.ts'
import { nutrientsForAmount } from '../../logic/nutrients.ts'
import {
  cookingLoss,
  cookingLossText,
  nextFinalWeight,
  rawWeight,
  recipePer100,
  recipeTotals,
  validateRecipe,
  type RecipeFormValues,
  type RecipeLine,
} from '../../logic/recipe.ts'
import { useFoodResolver } from '../add/useFoodResolver.ts'
import { CostCard } from './CostCard.tsx'
import { FoodPickerSheet } from './FoodPickerSheet.tsx'
import { PortionsCard } from './PortionsCard.tsx'
import { usePriceLookup } from './usePriceLookup.ts'

const LIST = href('lebensmittel')
// Kein Rezept im Rezept (Kreisbezüge)
const noRecipes = (food: FoodChoice) => food.ref.startsWith('recipe:')

export function RecipeForm({ id }: { id?: string }) {
  // null = nicht (mehr) vorhanden, undefined = lädt
  const existing = useLiveQuery(async () => {
    if (!id) return null
    const r = await db.recipes.get(id)
    return r && r.deletedAt === null ? r : null
  }, [id])

  if (id && existing === undefined) return <SubScreen back={LIST} />
  if (id && !existing) {
    return (
      <SubScreen back={LIST}>
        <SubScreenTitle title="Nicht gefunden" meta="Dieses Rezept gibt es nicht mehr." />
      </SubScreen>
    )
  }
  // Startwerte nur einmal übernehmen; spätere Datenbank-Änderungen überschreiben die Eingaben nicht
  return <RecipeBody key={id ?? 'neu'} recipe={existing ?? null} />
}

/** null = Sheet zu, 'new' = Zutat hinzufügen, Zahl = Index der geänderten Zutat */
type Picking = null | 'new' | number

function RecipeBody({ recipe }: { recipe: Recipe | null }) {
  const toast = useToast()
  const sources = useLiveQuery(loadFoodSources, [])
  const bls = useBls()
  const blsData = bls.status === 'ready' ? bls.data : null
  const resolver = useFoodResolver(sources, blsData)
  const prices = usePriceLookup(sources)
  const used = useLiveQuery(() => (recipe ? isFoodUsed(`recipe:${recipe.id}`) : Promise.resolve(false)), [recipe])

  const [values, setValues] = useState<RecipeFormValues>(() =>
    recipe
      ? {
          name: recipe.name,
          ingredients: recipe.ingredients,
          finalWeightG: recipe.finalWeightG,
          portions: recipe.portions,
        }
      : { name: '', ingredients: [], finalWeightG: null, portions: [] },
  )
  const [picking, setPicking] = useState<Picking>(null)
  const [weightOpen, setWeightOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = <K extends keyof RecipeFormValues>(key: K, value: RecipeFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }))

  const lines = values.ingredients.map((ingredient) => ({ ingredient, food: resolver.resolve(ingredient.ref) }))
  const resolved = lines.filter((l): l is RecipeLine => l.food !== undefined)
  // Solange eine Zutat fehlt (z. B. BLS lädt noch), ist pro 100 g nicht rechenbar
  const complete = resolved.length === lines.length
  const raw = rawWeight(lines)
  const totalKcal = recipeTotals(resolved).kcal
  const per100 = complete ? recipePer100(resolved, values.finalWeightG ?? Number.NaN) : null
  const loss = values.finalWeightG === null ? null : cookingLoss(raw, values.finalWeightG)
  const check = validateRecipe(values)

  const editLine = typeof picking === 'number' ? lines[picking] : undefined
  const unknownName = bls.status === 'loading' ? 'Wird geladen …' : 'Unbekanntes Lebensmittel'
  // Kosten aus den aktuellen Eingaben, damit sie beim Bearbeiten mitlaufen
  const perG = prices && recipeUnitPrice({ ingredients: values.ingredients, finalWeightG: values.finalWeightG ?? 0 }, prices)
  const costRows = prices && [
    { label: 'Ganzer Topf', value: costText(itemsCost(values.ingredients, prices)) },
    { label: 'Pro 100 g fertig', value: formatEuro(perG === null ? null : perG * 100) },
    ...values.portions.map((p) => ({
      label: `${p.label} (${formatAmount(p.amount)} g)`,
      value: formatEuro(perG === null ? null : perG * p.amount),
    })),
  ]

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
      if (recipe) await updateRecipe(recipe.id, check.data)
      else await createRecipe(check.data)
      navigate(LIST, { replace: true })
    }, 'Gespeichert')
  }

  const grams = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${formatNumber(v, 1)} g`)
  const tiles = [
    { label: 'Eiweiß', value: grams(per100?.protein) },
    { label: 'Kohlenh.', value: grams(per100?.carbs) },
    { label: 'Fett', value: grams(per100?.fat) },
  ]

  return (
    <>
      <header className="pt-safe-header flex shrink-0 items-center justify-between pr-2 pl-1">
        <a href={LIST} className="text-accent-text text-body-large flex min-h-touch-min items-center px-3">
          Abbrechen
        </a>
        <h1 className="text-sheet-title truncate">{recipe ? 'Rezept' : 'Neues Rezept'}</h1>
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
            onChange={(e) => set('name', e.target.value)}
            placeholder="Name des Rezepts"
            autoComplete="off"
            enterKeyHint="done"
            className="text-sheet-title placeholder:text-muted min-w-0 flex-1 bg-transparent outline-none placeholder:font-normal"
          />
        </label>

        <Card padded={false}>
          <div className="flex min-h-12 items-center justify-between pr-2 pl-4">
            <h2 className="text-body font-semibold">Zutaten (roh)</h2>
            <Button variant="text" className="text-label" onClick={() => setPicking('new')}>
              + Zutat
            </Button>
          </div>
          {lines.length === 0 && (
            <p className="border-line text-label text-muted flex min-h-12 items-center border-t px-4">
              Noch keine Zutaten. Wiege sie roh ab.
            </p>
          )}
          {lines.map((l, i) => (
            <button
              key={`${l.ingredient.ref}-${i}`}
              type="button"
              disabled={!l.food}
              onClick={() => setPicking(i)}
              className="border-line text-label flex min-h-12 w-full items-center gap-2 border-t px-4 text-left"
            >
              <span className="min-w-0 flex-1 truncate">{l.food?.name ?? unknownName}</span>
              <span className="text-muted min-w-[54px] text-right whitespace-nowrap">
                {formatAmount(l.ingredient.amount)} {l.food?.unit ?? 'g'}
              </span>
              <span className="text-muted min-w-[66px] text-right whitespace-nowrap">
                {formatNumber(l.food ? nutrientsForAmount(l.food.per100, l.ingredient.amount).kcal : null)} kcal
              </span>
            </button>
          ))}
          {lines.length > 0 && (
            <div className="border-line text-label flex min-h-[46px] items-center justify-between border-t px-4">
              <span className="text-muted">Summe roh</span>
              <span className="font-semibold">
                {formatAmount(raw)} g · {formatSum(complete ? totalKcal : { ...totalKcal, atLeast: true })} kcal
              </span>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-body font-semibold">Endgewicht nach dem Kochen</h2>
          <p className="text-secondary text-muted mt-1 leading-[1.4]">
            Topf leer wiegen, dann mit Inhalt. Die Differenz ist das Endgewicht.
          </p>
          <div className="mt-2.5 flex items-center justify-between">
            <button
              type="button"
              aria-label="50 g weniger"
              onClick={() => set('finalWeightG', nextFinalWeight(values.finalWeightG, raw, -1))}
              className="press rounded-field bg-bg flex size-12 items-center justify-center"
            >
              <IconMinus />
            </button>
            <button
              type="button"
              aria-label="Endgewicht eingeben"
              onClick={() => setWeightOpen(true)}
              className="text-ring min-h-touch-min px-2"
            >
              {values.finalWeightG === null ? '–' : formatAmount(values.finalWeightG)}
              <span className="text-body-large text-muted font-medium"> g</span>
            </button>
            <button
              type="button"
              aria-label="50 g mehr"
              onClick={() => set('finalWeightG', nextFinalWeight(values.finalWeightG, raw, 1))}
              className="press rounded-field bg-bg flex size-12 items-center justify-center"
            >
              <IconPlus size={20} strokeWidth={2} />
            </button>
          </div>
          <span
            className={`text-small mt-1.5 block text-center ${loss?.state === 'high' ? 'text-warn-text' : 'text-muted'}`}
            aria-live="polite"
          >
            {loss ? cookingLossText(loss) : 'Tipp auf die Zahl zum Eintippen'}
          </span>
        </Card>

        <Card>
          <div className="flex items-baseline justify-between">
            <h2 className="text-body font-semibold">Pro 100 g fertig</h2>
            <span className="text-unit font-semibold">
              {formatNumber(per100?.kcal ?? null)} <span className="text-secondary text-muted font-normal">kcal</span>
            </span>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {tiles.map((t) => (
              <div key={t.label} className="bg-bg rounded-tile flex flex-col gap-0.5 px-2.5 py-2">
                <span className="text-tiny text-muted">{t.label}</span>
                <span className="text-label font-semibold">{t.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <PortionsCard
          portions={values.portions}
          unit="g"
          kcalPer100={per100?.kcal ?? null}
          onSave={async (portions) => set('portions', portions)}
        />

        {prices && costRows && values.ingredients.length > 0 && (
          <CostCard
            rows={costRows}
            missing={missingPrices(values.ingredients, prices).map((ref) => resolver.resolve(ref)?.name ?? unknownName)}
          />
        )}

        {recipe && (
          <p className="text-small text-muted px-1 leading-[1.45]">
            Änderungen gelten nur für künftige Einträge. Was schon im Tagebuch steht, bleibt gleich
            {prices ? ', nur die Kosten rechnen immer mit dem aktuellen Rezept.' : '.'}
          </p>
        )}
        {!check.ok && (values.name !== '' || values.ingredients.length > 0) && (
          <p className="text-small text-muted px-1 leading-[1.45]">Zum Sichern fehlt noch: {check.error}</p>
        )}

        {recipe &&
          (recipe.archived ? (
            <Button
              variant="text"
              className="text-label justify-center font-medium"
              disabled={busy}
              onClick={() => void run(() => restoreRecipe(recipe.id), 'Wiederhergestellt')}
            >
              Wiederherstellen
            </Button>
          ) : used ? (
            // Im Tagebuch oder in einer Mahlzeit verwendet: nur archivieren
            <Button
              variant="text"
              className="text-label text-warn-text justify-center font-medium"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await archiveRecipe(recipe.id)
                  navigate(LIST, { replace: true })
                }, 'Archiviert')
              }
            >
              Archivieren
            </Button>
          ) : (
            <Button
              variant="text"
              className="text-label text-danger justify-center font-medium"
              disabled={busy}
              onClick={() => {
                // Zweiter Tipp bestätigt, kein Popup
                if (!confirmDelete) return setConfirmDelete(true)
                void run(async () => {
                  await deleteRecipe(recipe.id)
                  navigate(LIST, { replace: true })
                }, 'Gelöscht')
              }}
            >
              {confirmDelete ? 'Wirklich löschen? Nochmal tippen' : 'Löschen'}
            </Button>
          ))}
      </main>

      <FoodPickerSheet
        open={picking !== null}
        onClose={() => setPicking(null)}
        title={picking === 'new' ? 'Zutat hinzufügen' : 'Zutat'}
        editing={editLine?.food ? { food: editLine.food, amount: editLine.ingredient.amount } : null}
        sources={sources}
        bls={blsData}
        resolver={resolver}
        exclude={noRecipes}
        confirmLabel={picking === 'new' ? 'Zum Rezept hinzufügen' : 'Übernehmen'}
        onConfirm={(food, amount) =>
          setValues((v) => ({
            ...v,
            ingredients:
              typeof picking === 'number'
                ? v.ingredients.map((ing, i) => (i === picking ? { ref: food.ref, amount } : ing))
                : [...v.ingredients, { ref: food.ref, amount }],
          }))
        }
        onRemove={() =>
          setValues((v) => ({ ...v, ingredients: v.ingredients.filter((_, i) => i !== picking) }))
        }
      />

      <Sheet open={weightOpen} onClose={() => setWeightOpen(false)} title="Endgewicht" doneLabel="Abbrechen">
        {weightOpen && (
          <WeightKeypad
            initial={values.finalWeightG}
            onConfirm={(weight) => {
              set('finalWeightG', weight)
              setWeightOpen(false)
            }}
          />
        )}
      </Sheet>
    </>
  )
}

function WeightKeypad({ initial, onConfirm }: { initial: number | null; onConfirm: (weight: number) => void }) {
  const [text, setText] = useState(initial === null ? '' : amountToKeypad(initial))
  const value = parseKeypadValue(text) ?? 0
  return (
    <div className="px-screen-x flex min-h-0 flex-1 flex-col pb-[calc(16px+env(safe-area-inset-bottom))]">
      <div className="px-1 pt-3.5 pb-1.5" aria-live="polite">
        <span className="text-hero">
          {text || '0'}
          <span className="text-unit text-muted"> g</span>
        </span>
      </div>
      <p className="text-secondary text-muted px-1 leading-[1.4]">Gewicht des fertigen Gerichts ohne Topf.</p>
      <div className="mt-auto">
        <Keypad value={text} onChange={setText} />
      </div>
      <Button className="mt-2.5 w-full" disabled={value <= 0} onClick={() => onConfirm(value)}>
        Übernehmen
      </Button>
    </div>
  )
}
