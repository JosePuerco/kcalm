// Such-Schritt im Hinzufügen-Sheet nach Kern.dc.html: Suchfeld, Liste „Zuletzt gegessen“ bzw. „Treffer lokal“
// (Name, Quelle, geprüft-Häkchen, kcal/100). Scan, Mahlzeiten, Rezepte und die Suche in Open Food Facts
// kommen in ihren Phasen dazu.
import { useMemo } from 'react'
import { IconCheck, IconChevronRight, IconSearch } from '../../components/icons/icons.tsx'
import type { BlsData } from '../../data/bls.ts'
import type { FoodSources } from '../../db/entries.ts'
import type { FoodRef } from '../../db/types.ts'
import { choiceFromBls, choiceFromProduct, per100Label, recentRefs, type FoodChoice } from '../../logic/addFood.ts'
import { createSearchIndex, search } from '../../logic/search.ts'

const BLS_LIMIT = 30

type Props = {
  query: string
  onQuery: (query: string) => void
  sources: FoodSources
  bls: BlsData | null
  onPick: (food: FoodChoice) => void
}

export function SearchStep({ query, onQuery, sources, bls, onPick }: Props) {
  const { byRef, productIndex } = useMemo(() => {
    const overrides = new Map(sources.overrides.map((o) => [o.productRef, o]))
    const prefs = new Map(sources.blsPrefs.map((p) => [p.blsCode, p]))
    const products = sources.products.map((p) => choiceFromProduct(p, overrides.get(`product:${p.id}`)))
    const map = new Map<FoodRef, FoodChoice>(products.map((c) => [c.ref, c]))
    const resolveBls = (code: string) => {
      const food = bls?.byCode.get(code)
      return food ? choiceFromBls(food, prefs.get(code), overrides.get(`bls:${code}`)) : undefined
    }
    const brands = new Map(sources.products.map((p) => [`product:${p.id}`, p.brand ?? '']))
    return {
      byRef: (ref: FoodRef) => map.get(ref) ?? (ref.startsWith('bls:') ? resolveBls(ref.slice(4)) : undefined),
      productIndex: createSearchIndex(
        products.filter((c) => !c.archived),
        (c) => c.name,
        (c) => brands.get(c.ref) ?? '',
      ),
    }
  }, [sources, bls])

  const searching = query.trim() !== ''
  const results = useMemo(() => {
    if (!searching) {
      return recentRefs(sources.recent)
        .map(byRef)
        .filter((c): c is FoodChoice => !!c)
    }
    const own = search(productIndex, query)
    const blsHits = bls
      ? search(bls.index, query, BLS_LIMIT).map((f) => byRef(`bls:${f.code}`)).filter((c): c is FoodChoice => !!c)
      : []
    return [...own, ...blsHits]
  }, [searching, query, sources.recent, byRef, productIndex, bls])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-screen-x flex gap-2">
        <label className="rounded-field bg-card flex h-[46px] flex-1 items-center gap-2 px-3">
          <IconSearch size={18} strokeWidth={2} className="text-muted shrink-0" />
          <span className="sr-only">Suchen</span>
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Lebensmittel suchen"
            enterKeyHint="search"
            autoComplete="off"
            className="text-body-large text-text placeholder:text-muted min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
      </div>

      <span className="text-small text-muted px-4 pt-3.5 pb-1 tracking-[0.6px] uppercase">
        {searching ? 'Treffer lokal' : 'Zuletzt gegessen'}
      </span>
      <div className="scroll-area px-screen-x pb-[calc(24px+env(safe-area-inset-bottom))]">
        {results.length > 0 ? (
          <div className="bg-card rounded-card overflow-hidden">
            {results.map((food, i) => (
              <button
                key={food.ref}
                type="button"
                onClick={() => onPick(food)}
                className={`flex min-h-14 w-full items-center gap-2.5 px-3.5 py-2 text-left ${i > 0 ? 'border-line border-t' : ''}`}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-body font-medium break-words">{food.name}</span>
                  <span className="text-small text-muted flex items-center gap-1">
                    {food.source}
                    {food.verified && (
                      <IconCheck size={12} strokeWidth={2.6} className="text-accent-text" role="img" aria-label="geprüft" aria-hidden={false} />
                    )}
                  </span>
                </span>
                <span className="text-secondary text-muted whitespace-nowrap">{per100Label(food)}</span>
                <IconChevronRight className="text-muted shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-label text-muted px-1 pt-1">
            {searching
              ? bls
                ? 'Keine Treffer. Eigene Produkte legst du unter Lebensmittel an.'
                : 'Keine Treffer in deinen Produkten. BLS wird geladen …'
              : 'Noch nichts gegessen. Such nach einem Lebensmittel.'}
          </p>
        )}
      </div>
    </div>
  )
}
