// Verweis („product:…“, „bls:…“, „recipe:…“) → Lebensmittel für Suche und Bearbeiten; dazu der Suchindex der
// Produkte und Rezepte.
import { useMemo } from 'react'
import type { BlsData } from '../../data/bls.ts'
import type { FoodSources } from '../../db/entries.ts'
import type { FoodRef } from '../../db/types.ts'
import { choiceFromBls, choiceFromProduct, type FoodChoice } from '../../logic/addFood.ts'
import { choiceFromRecipe } from '../../logic/recipe.ts'
import { createSearchIndex, type SearchIndex } from '../../logic/search.ts'

export interface FoodResolver {
  resolve: (ref: FoodRef) => FoodChoice | undefined
  /** nicht archivierte Produkte und Rezepte, Marke als Zusatz durchsuchbar */
  productIndex: SearchIndex<FoodChoice>
}

export function useFoodResolver(sources: FoodSources | undefined, bls: BlsData | null): FoodResolver {
  return useMemo(() => {
    const overrides = new Map((sources?.overrides ?? []).map((o) => [o.productRef, o]))
    const prefs = new Map((sources?.blsPrefs ?? []).map((p) => [p.blsCode, p]))
    const products = (sources?.products ?? []).map((p) => ({
      brand: p.brand ?? '',
      choice: choiceFromProduct(p, overrides.get(`product:${p.id}`)),
    }))
    const byRef = new Map<FoodRef, FoodChoice>(products.map(({ choice }) => [choice.ref, choice]))
    const brands = new Map(products.map(({ choice, brand }) => [choice.ref, brand]))

    // Produkte und BLS; Zutaten eines Rezepts kommen nur von hier (kein Rezept im Rezept)
    const resolveFood = (ref: FoodRef) => {
      const product = byRef.get(ref)
      if (product || !ref.startsWith('bls:')) return product
      const code = ref.slice(4)
      const food = bls?.byCode.get(code)
      return food ? choiceFromBls(food, prefs.get(code), overrides.get(ref)) : undefined
    }

    // Rezepte, deren Zutaten sich auflösen lassen (BLS-Zutaten erst, wenn die BLS-Daten geladen sind)
    const recipes = new Map<FoodRef, FoodChoice>()
    for (const r of sources?.recipes ?? []) {
      const choice = choiceFromRecipe(r, resolveFood)
      if (choice) recipes.set(choice.ref, choice)
    }

    const resolve = (ref: FoodRef) => (ref.startsWith('recipe:') ? recipes.get(ref) : resolveFood(ref))

    const productIndex = createSearchIndex(
      [...products.map((p) => p.choice), ...recipes.values()].filter((c) => !c.archived),
      (c) => c.name,
      (c) => brands.get(c.ref) ?? '',
    )
    return { resolve, productIndex }
  }, [sources, bls])
}
