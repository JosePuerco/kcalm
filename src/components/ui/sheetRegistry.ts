// Zählt offene Sheets. Der Toast sitzt höher, wenn kein Sheet offen ist.
import { useEffect, useSyncExternalStore } from 'react'

let openSheets = 0
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** Meldet ein offenes Sheet an, solange `open` true ist */
export function useRegisterSheet(open: boolean) {
  useEffect(() => {
    if (!open) return
    openSheets += 1
    notify()
    return () => {
      openSheets -= 1
      notify()
    }
  }, [open])
}

export function useAnySheetOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => openSheets > 0,
  )
}
