// Motion-Werte aus design/tokens.json für motion/react.
import { useReducedMotion } from 'motion/react'
import tokens from '../../design/tokens.json'

export type Bezier = [number, number, number, number]

/** „cubic-bezier(.2,1,.35,1)“ → [0.2, 1, 0.35, 1]; benannte Kurven übersetzen */
export function parseEasing(easing: string): Bezier | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' {
  const m = /^cubic-bezier\(([^)]+)\)$/.exec(easing.trim())
  if (m) {
    const parts = m[1]!.split(',').map((p) => Number(p.trim()))
    if (parts.length === 4 && parts.every(Number.isFinite)) return parts as Bezier
    throw new Error(`Ungültige Kurve: ${easing}`)
  }
  if (easing === 'easeOutCubic') return [0.33, 1, 0.68, 1]
  if (easing === 'ease') return [0.25, 0.1, 0.25, 1]
  if (easing === 'ease-in-out') return [0.42, 0, 0.58, 1]
  throw new Error(`Unbekannte Kurve: ${easing}`)
}

type Named = { durationMs: number; easing: string }

function transition(t: Named) {
  return { duration: t.durationMs / 1000, ease: parseEasing(t.easing) }
}

const m = tokens.motion

/** Fertige Übergänge für motion/react (duration in Sekunden) */
export const motionTokens = {
  sheetIn: transition(m.sheetIn),
  sheetOut: transition(m.sheetOut),
  scrimIn: transition(m.scrimIn),
  // Scrim schließt im Takt des Sheets
  scrimOut: { duration: m.sheetOut.durationMs / 1000, ease: parseEasing('ease') },
  expand: transition(m.expand),
  expandOffsetY: m.expand.offsetY,
  sheetStep: transition(m.sheetStep),
  sheetStepOffsetX: m.sheetStep.offsetX,
  barsAndRing: transition(m.barsAndRing),
  numberTween: transition(m.numberTween),
  toast: transition(m.toast),
  toastVisibleMs: m.toast.visibleMs,
  switchKnob: transition(m.switchKnob),
} as const

/** Ohne Bewegung: Dauer 0, Zustände sofort (DESIGN.md 4) */
export const instant = { duration: 0 } as const

/** true, wenn „Bewegung reduzieren“ aktiv ist */
export function useReduced(): boolean {
  return useReducedMotion() ?? false
}
