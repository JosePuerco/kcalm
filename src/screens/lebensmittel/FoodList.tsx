// Lebensmittel-Liste nach Lebensmittel.dc.html: Suche, Reiter, Filter, Zeilen, Fußnote, Archiv.
// Abweichung (mit Jan abgestimmt): Beim Suchen erscheinen BLS-Treffer als eigener Abschnitt.
import { useMemo } from 'react'
import { href } from '../../app/router.ts'
import { IconCheck, IconChevronRight, IconPlus, IconSearch } from '../../components/icons/icons.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { Chip } from '../../components/ui/Chip.tsx'
import { Screen } from '../../components/ui/Screen.tsx'
import { Segmented } from '../../components/ui/Segmented.tsx'
import { useBls } from '../../data/bls.ts'
import { db } from '../../db/db.ts'
import { useLiveQuery } from '../../db/live.ts'
import type { FoodRef } from '../../db/types.ts'
import type { BlsFood } from '../../logic/blsFoods.ts'
import { buildFoodRows, countArchived, filterFoodRows, type FoodFilter, type FoodRow } from '../../logic/foodList.ts'
import { formatNutrient } from '../../logic/nutrientInfo.ts'
import { createSearchIndex, search } from '../../logic/search.ts'
import type { FoodListState, FoodTab } from './foodListState.ts'


const TABS = [
  { value: 'products', label: 'Produkte' },
  { value: 'meals', label: 'Mahlzeiten' },
  { value: 'recipes', label: 'Rezepte' },
] as const
const FILTERS: { value: FoodFilter; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'verified', label: 'Geprüft' },
  { value: 'own', label: 'Eigene' },
  { value: 'bls', label: 'BLS' },
]
const FOOT: Record<FoodTab, string> = {
  products:
    'Produkte aus Open Food Facts landen hier automatisch nach dem ersten Scan. BLS-Lebensmittel erscheinen erst, wenn du eine Portion anlegst oder sie prüfst.',
  meals: 'Mahlzeiten sind Gruppen von Produkten mit Standardmengen.',
  recipes: 'Rezepte rechnen pro 100 g über das Endgewicht nach dem Kochen.',
}
const BLS_HIT_LIMIT = 30
const NO_BLS = new Map<string, BlsFood>()

function rowHref(ref: FoodRef): string {
  const [kind, id = ''] = ref.split(/:(.*)/)
  return kind === 'bls' ? href('lebensmittel', 'bls', id) : href('lebensmittel', 'produkt', id)
}

type Props = { state: FoodListState; onChange: (state: FoodListState) => void }

export function FoodList({ state, onChange }: Props) {
  const update = (changes: Partial<FoodListState>) => onChange({ ...state, ...changes })
  const bls = useBls()
  const blsMap = bls.status === 'ready' ? bls.data.byCode : NO_BLS
  const data = useLiveQuery(
    async () => ({
      products: await db.products.toArray(),
      blsPrefs: await db.blsPrefs.toArray(),
      overrides: await db.productOverrides.toArray(),
    }),
    [],
  )

  const rows = useMemo(() => (data ? buildFoodRows({ ...data, bls: blsMap }) : []), [data, blsMap])
  const query = state.query.trim()
  const searching = query !== ''

  const visible = useMemo(() => {
    const filtered = filterFoodRows(rows, state.filter, state.archived)
    if (!searching) return filtered
    return search(createSearchIndex(filtered, (r) => r.name, (r) => r.brand ?? ''), query)
  }, [rows, state.filter, state.archived, searching, query])

  // BLS-Treffer, die noch nicht in deinen Lebensmitteln stehen
  const showBlsHits = searching && !state.archived && (state.filter === 'all' || state.filter === 'bls')
  const blsHits = useMemo(() => {
    if (!showBlsHits || bls.status !== 'ready') return []
    const own = new Set(rows.map((r) => r.ref))
    return search(bls.data.index, query, BLS_HIT_LIMIT + own.size)
      .filter((f) => !own.has(`bls:${f.code}`))
      .slice(0, BLS_HIT_LIMIT)
  }, [showBlsHits, bls, rows, query])

  const archivedCount = countArchived(rows)
  const isProducts = state.tab === 'products'

  const toolbar = (
    <>
      <div className="px-screen-x pt-1 pb-2">
        <label className="bg-card rounded-field flex h-[46px] items-center gap-2 px-3">
          <IconSearch size={18} strokeWidth={2} className="text-muted flex-none" />
          <span className="sr-only">Suchen</span>
          <input
            type="search"
            value={state.query}
            onChange={(e) => update({ query: e.target.value })}
            placeholder="Lebensmittel suchen"
            autoComplete="off"
            enterKeyHint="search"
            className="text-body-large placeholder:text-muted min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
      </div>
      <div className="px-screen-x pb-2.5">
        <Segmented
          label="Art"
          options={TABS}
          value={state.tab}
          onChange={(tab: FoodTab) => update({ tab, filter: 'all', archived: false })}
        />
      </div>
      {isProducts && (
        <div className="px-screen-x flex gap-1.5 pb-2.5">
          {FILTERS.map((f) => (
            <Chip key={f.value} variant="filter" active={state.filter === f.value} onClick={() => update({ filter: f.value })}>
              {f.label}
            </Chip>
          ))}
        </div>
      )}
    </>
  )

  return (
    <Screen
      title="Lebensmittel"
      action={
        <a
          href={href('lebensmittel', 'neu')}
          aria-label="Neu anlegen"
          className="press bg-card text-accent-text flex size-11 items-center justify-center rounded-full"
        >
          <IconPlus size={20} />
        </a>
      }
      toolbar={toolbar}
    >
      {!isProducts ? (
        // Mahlzeiten und Rezepte kommen in Phase 5
        <Card padded={false}>
          <Empty>{state.tab === 'meals' ? 'Noch keine Mahlzeiten.' : 'Noch keine Rezepte.'}</Empty>
        </Card>
      ) : (
        data && (
          <>
            {state.archived && <SectionTitle>Archiviert</SectionTitle>}
            <Card padded={false}>
              {visible.map((row, i) => (
                <FoodRowLink key={row.ref} row={row} first={i === 0} />
              ))}
              {visible.length === 0 && <Empty>{emptyText(state, rows.length, searching)}</Empty>}
            </Card>

            {showBlsHits && (
              <>
                <SectionTitle>Aus dem BLS</SectionTitle>
                <Card padded={false}>
                  {bls.status === 'loading' && <Empty>BLS wird geladen …</Empty>}
                  {bls.status === 'error' && <Empty>Die BLS-Daten konnten nicht geladen werden.</Empty>}
                  {bls.status === 'ready' && blsHits.length === 0 && <Empty>Keine Treffer im BLS.</Empty>}
                  {blsHits.map((food, i) => (
                    <FoodRowLink
                      key={food.code}
                      first={i === 0}
                      row={{
                        ref: `bls:${food.code}`,
                        name: food.name,
                        meta: 'BLS',
                        kcalPer100: food.per100.kcal,
                        verified: false,
                      }}
                    />
                  ))}
                </Card>
              </>
            )}
          </>
        )
      )}

      {!state.archived && <p className="text-small text-muted px-1 leading-[1.45]">{FOOT[state.tab]}</p>}
      {isProducts && (archivedCount > 0 || state.archived) && (
        <button
          type="button"
          onClick={() => update({ archived: !state.archived })}
          className="text-label text-muted min-h-touch-min text-center font-medium"
        >
          {state.archived ? 'Zurück zur Liste' : `Archiviert (${archivedCount})`}
        </button>
      )}
    </Screen>
  )
}

function emptyText(state: FoodListState, total: number, searching: boolean): string {
  if (searching) return 'Keine Treffer in deinen Lebensmitteln.'
  if (state.archived) return 'Nichts archiviert.'
  if (total === 0) return 'Noch keine Lebensmittel. Lege oben mit + ein eigenes Produkt an oder suche ein Grundlebensmittel aus dem BLS.'
  return 'Keine Treffer.'
}

function FoodRowLink({
  row,
  first,
}: {
  row: Pick<FoodRow, 'ref' | 'name' | 'meta' | 'kcalPer100' | 'verified'>
  first: boolean
}) {
  return (
    <a
      href={rowHref(row.ref)}
      className={`text-text flex min-h-[60px] items-center gap-2.5 pr-3 pl-4 ${first ? '' : 'border-line border-t'}`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
        <span className="text-body truncate font-medium">{row.name}</span>
        <span className="text-small text-muted flex items-center gap-[5px]">
          <span className="truncate">{row.meta}</span>
          {row.verified && (
            <span className="text-accent-text inline-flex flex-none items-center gap-0.5 font-medium">
              <IconCheck size={12} strokeWidth={2.6} />
              geprüft
            </span>
          )}
        </span>
      </span>
      <span className="text-secondary text-muted whitespace-nowrap">{formatNutrient('kcal', row.kcalPer100)} /100</span>
      <IconChevronRight className="text-chevron-muted flex-none" />
    </a>
  )
}

function Empty({ children }: { children: string }) {
  return <p className="text-label text-muted px-5 py-7 text-center">{children}</p>
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-small text-muted px-1 pt-1 font-medium">{children}</h2>
}
