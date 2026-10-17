// Lebensmittel: Liste und Unterseiten über den Hash-Pfad
//  #/lebensmittel                              Liste
//  #/lebensmittel/neu                          neues Produkt
//  #/lebensmittel/produkt/<id>                 Produktdetail
//  #/lebensmittel/produkt/<id>/bearbeiten      Produkt bearbeiten
//  #/lebensmittel/bls/<code>                   BLS-Lebensmittel
import { useState } from 'react'
import { useSubPath } from '../app/router.ts'
import { BlsDetail } from './lebensmittel/BlsDetail.tsx'
import { FoodList } from './lebensmittel/FoodList.tsx'
import { initialFoodListState } from './lebensmittel/foodListState.ts'
import { ProductDetail } from './lebensmittel/ProductDetail.tsx'
import { ProductForm } from './lebensmittel/ProductForm.tsx'

export function Lebensmittel() {
  const [view, id, action] = useSubPath()
  // Liegt hier statt in der Liste, damit Suche, Reiter und Filter nach dem Zurück erhalten bleiben
  const [listState, setListState] = useState(initialFoodListState)

  if (view === 'neu') return <ProductForm />
  if (view === 'produkt' && id && action === 'bearbeiten') return <ProductForm id={id} />
  if (view === 'produkt' && id) return <ProductDetail key={id} id={id} />
  if (view === 'bls' && id) return <BlsDetail key={id} code={id} />
  return <FoodList state={listState} onChange={setListState} />
}
