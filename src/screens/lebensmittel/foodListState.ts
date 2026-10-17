// Zustand der Lebensmittel-Liste; liegt im Screen, damit er beim Zurück erhalten bleibt.
import type { FoodFilter } from '../../logic/foodList.ts'

export type FoodTab = 'products' | 'meals' | 'recipes'

export interface FoodListState {
  tab: FoodTab
  filter: FoodFilter
  query: string
  archived: boolean
}

export const initialFoodListState: FoodListState = { tab: 'products', filter: 'all', query: '', archived: false }
