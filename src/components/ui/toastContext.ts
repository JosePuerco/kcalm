import { createContext, useContext } from 'react'

export const ToastContext = createContext<(message: string) => void>(() => {})

/** Liefert eine Funktion, die einen Toast zeigt */
export function useToast() {
  return useContext(ToastContext)
}
