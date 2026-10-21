// Gemeinsamer Zustand des Tagebuchs, der einen Screen-Wechsel überlebt: angezeigter Tag,
// eingeklappte Slots. Liegt außerhalb von React, damit auch das Hinzufügen-Sheet den Tag kennt.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { toLocalDate } from '../logic/dates.ts'
import type { LocalDate } from '../db/types.ts'

type State = {
  /** null = folgt „heute“, auch über Mitternacht */
  date: LocalDate | null
  /** vom Nutzer eingeklappte bzw. aufgeklappte Slots (Slot-id → offen?) */
  open: Record<string, boolean>
}

let state: State = { date: null, open: {} }
const listeners = new Set<() => void>()

function set(next: Partial<State>) {
  state = { ...state, ...next }
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useDiaryState(): State {
  return useSyncExternalStore(subscribe, () => state)
}

/** Heute auf „null“ zurücksetzen, damit die Ansicht nach Mitternacht mitwandert */
export function setDiaryDate(date: LocalDate, today: LocalDate) {
  set({ date: date === today ? null : date })
}

export function setSlotOpen(slotId: string, open: boolean) {
  set({ open: { ...state.open, [slotId]: open } })
}

/** Heutiges Datum; aktualisiert sich um Mitternacht und beim Zurückkehren in die App */
export function useToday(): LocalDate {
  const [today, setToday] = useState(() => toLocalDate(new Date()))
  useEffect(() => {
    const update = () => setToday(toLocalDate(new Date()))
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    // Kleiner Puffer, damit der Timer sicher nach Mitternacht feuert
    const timer = setTimeout(update, midnight.getTime() - now.getTime() + 500)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [today])
  return today
}

// Hinzufügen-Sheet: „+“ in der Navigation (Slot nach Uhrzeit) oder „+“ am Slot (dieser Slot)
type AddSheet = { open: boolean; slotId: string | null }
let addSheet: AddSheet = { open: false, slotId: null }
const addListeners = new Set<() => void>()

function setAddSheet(next: AddSheet) {
  addSheet = next
  for (const l of addListeners) l()
}

function subscribeAdd(listener: () => void) {
  addListeners.add(listener)
  return () => addListeners.delete(listener)
}

export function useAddSheet(): AddSheet {
  return useSyncExternalStore(subscribeAdd, () => addSheet)
}

/** slotId null = Slot zur Uhrzeit */
export const openAddSheet = (slotId: string | null = null) => setAddSheet({ open: true, slotId })
export const closeAddSheet = () => setAddSheet({ ...addSheet, open: false })

