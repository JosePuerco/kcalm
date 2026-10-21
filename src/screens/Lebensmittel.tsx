// Lebensmittel: Liste und Unterseiten über den Hash-Pfad
//  #/lebensmittel                              Liste
//  #/lebensmittel/neu                          neues Produkt
//  #/lebensmittel/produkt/<id>                 Produktdetail
//  #/lebensmittel/produkt/<id>/bearbeiten      Produkt bearbeiten (OFF: korrigieren)
//  #/lebensmittel/bls/<code>                   BLS-Lebensmittel
//  #/lebensmittel/bls/<code>/bearbeiten        BLS-Werte korrigieren
//  #/lebensmittel/mahlzeit/neu                 neue Mahlzeit
//  #/lebensmittel/mahlzeit/<id>                Mahlzeit bearbeiten
//  #/lebensmittel/rezept/neu                   neues Rezept
//  #/lebensmittel/rezept/<id>                  Rezept bearbeiten
import { useState } from 'react'
import { useSubPath } from '../app/router.ts'
import { BlsDetail } from './lebensmittel/BlsDetail.tsx'
import { BlsCorrection } from './lebensmittel/CorrectionForm.tsx'
import { FoodList } from './lebensmittel/FoodList.tsx'
import { initialFoodListState } from './lebensmittel/foodListState.ts'
import { MealForm } from './lebensmittel/MealForm.tsx'
import { ProductDetail } from './lebensmittel/ProductDetail.tsx'
import { ProductForm } from './lebensmittel/ProductForm.tsx'
import { RecipeForm } from './lebensmittel/RecipeForm.tsx'

export function Lebensmittel() {
  const [view, id, action] = useSubPath()
  // Liegt hier statt in der Liste, damit Suche, Reiter und Filter nach dem Zurück erhalten bleiben
  const [listState, setListState] = useState(initialFoodListState)

  if (view === 'neu') return <ProductForm />
  if (view === 'produkt' && id && action === 'bearbeiten') return <ProductForm id={id} />
  if (view === 'produkt' && id) return <ProductDetail key={id} id={id} />
  if (view === 'bls' && id && action === 'bearbeiten') return <BlsCorrection key={id} code={id} />
  if (view === 'bls' && id) return <BlsDetail key={id} code={id} />
  if (view === 'mahlzeit' && id === 'neu') return <MealForm />
  if (view === 'mahlzeit' && id) return <MealForm key={id} id={id} />
  if (view === 'rezept' && id === 'neu') return <RecipeForm />
  if (view === 'rezept' && id) return <RecipeForm key={id} id={id} />
  return <FoodList state={listState} onChange={setListState} />
}
