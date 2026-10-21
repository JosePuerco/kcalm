// Gemeinsamer Zustand des Tagebuchs, der einen Screen-Wechsel überlebt: angezeigter Tag,
// eingeklappte Slots. Liegt außerhalb von React, damit auch das Hinzufügen-Sheet den Tag kennt.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { toLocalDate } from '../logic/dates.ts'
import type { LocalDate } from '../db/types.ts'
import tokens from '../../design/tokens.json'

const FLASH_MS = tokens.motion.newEntryFlash.durationMs

type State = {
  /** null = folgt „heute“, auch über Mitternacht */
  date: LocalDate | null
  /** vom Nutzer eingeklappte bzw. aufgeklappte Slots (Slot-id → offen?) */
  open: Record<string, boolean>
  /** zuletzt hinzugefügter Eintrag, blinkt kurz in der Tagesansicht */
  flashId: string | null
}

let state: State = { date: null, open: {}, flashId: null }
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

/** Nach dem Hinzufügen: Slot aufklappen und den neuen Eintrag blinken lassen */
export function showNewEntry(slotId: string, entryId: string) {
  set({ open: { ...state.open, [slotId]: true }, flashId: entryId })
  // Danach zurücksetzen, sonst blinkt der Eintrag nach einem Screen-Wechsel erneut
  setTimeout(() => state.flashId === entryId && set({ flashId: null }), FLASH_MS)
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

// Hinzufügen-Sheet: „+“ in der Navigation (Slot nach Uhrzeit), „+“ am Slot (dieser Slot)
// oder Tipp auf einen Eintrag (bearbeiten)
type AddSheet = { open: boolean; slotId: string | null; editId: string | null }
let addSheet: AddSheet = { open: false, slotId: null, editId: null }
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
export const openAddSheet = (slotId: string | null = null) => setAddSheet({ open: true, slotId, editId: null })
export const openEditSheet = (entryId: string) => setAddSheet({ open: true, slotId: null, editId: entryId })
export const closeAddSheet = () => setAddSheet({ ...addSheet, open: false })

