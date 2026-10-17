// Lädt public/bls.json beim ersten Bedarf (ca. 650 KB, im Offline-Cache) und hält sie im Speicher.
import { useEffect, useState } from 'react'
import { parseBlsFile, type BlsFood } from '../logic/blsFoods.ts'
import { createSearchIndex, type SearchIndex } from '../logic/search.ts'

export interface BlsData {
  foods: BlsFood[]
  byCode: Map<string, BlsFood>
  index: SearchIndex<BlsFood>
}

let pending: Promise<BlsData> | null = null

export function loadBls(): Promise<BlsData> {
  pending ??= fetch(`${import.meta.env.BASE_URL}bls.json`)
    .then((response) => {
      if (!response.ok) throw new Error(`bls.json: HTTP ${response.status}`)
      return response.json() as Promise<unknown>
    })
    .then((json) => {
      const foods = parseBlsFile(json)
      return {
        foods,
        byCode: new Map(foods.map((f) => [f.code, f])),
        index: createSearchIndex(foods, (f) => f.name),
      }
    })
    .catch((error: unknown) => {
      pending = null // beim nächsten Mal neu versuchen
      throw error
    })
  return pending
}

export type BlsState = { status: 'loading' } | { status: 'ready'; data: BlsData } | { status: 'error' }

export function useBls(): BlsState {
  const [state, setState] = useState<BlsState>({ status: 'loading' })
  useEffect(() => {
    let active = true
    loadBls().then(
      (data) => active && setState({ status: 'ready', data }),
      (error: unknown) => {
        console.error(error)
        if (active) setState({ status: 'error' })
      },
    )
    return () => {
      active = false
    }
  }, [])
  return state
}
