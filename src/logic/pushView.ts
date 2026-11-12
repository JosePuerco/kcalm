// Texte für den Server-Push in den Einstellungen (Phase 14e). Reine Funktionen, testbar.
// Zeitangaben wie beim Backup: „heute, 18:42“, „gestern“, „vor 3 Tagen“.

import type { Timestamp } from '../db/types.ts'
import { daysBetween, toLocalDate } from './dates.ts'
import { formatNumber, formatTime } from './format.ts'
import { readyConfig, type PushConfig, type PushState } from './push.ts'

export interface RowMeta {
  text: string
  warn: boolean
}

/** Relativ wie beim Backup; null = noch nie */
export function relativeTime(at: Timestamp | null, now = new Date()): string | null {
  if (at === null) return null
  const date = new Date(at)
  const days = Math.max(0, daysBetween(toLocalDate(date), toLocalDate(now)))
  if (days === 0) return `heute, ${formatTime(date)}`
  if (days === 1) return 'gestern'
  return `vor ${formatNumber(days)} Tagen`
}

/** Zeile „Server-Push“ in der Karte „Daten“; pending undefined = wird noch gezählt */
export function pushRowMeta(config: PushConfig, state: PushState, pending: number | undefined, now = new Date()): RowMeta {
  const ready = readyConfig(config)
  if (ready === null) return { text: 'Aus', warn: false }
  if (!ready.ok) return { text: 'Nicht eingerichtet', warn: true }
  if (state.lastError !== null) return { text: state.lastError, warn: true }
  if (pending !== undefined && pending > 0) return { text: `${formatNumber(pending)} ausstehend`, warn: false }
  const last = relativeTime(state.lastSuccessAt, now)
  if (last === null) return { text: 'Noch nicht übertragen', warn: false }
  return { text: `Übertragen ${last}`, warn: false }
}

export function lastSuccessText(state: PushState, now = new Date()): string {
  return relativeTime(state.lastSuccessAt, now) ?? 'Noch nie'
}

export function pendingText(n: number): string {
  return n === 1 ? '1 Änderung' : `${formatNumber(n)} Änderungen`
}

/** Satz unter „Über“ */
export function dataLocationText(config: PushConfig): string {
  return config.enabled ? 'Daten liegen auf diesem Gerät und deinem eigenen Server' : 'alle Daten bleiben auf diesem Gerät'
}

export type ManualOutcome =
  | { kind: 'disabled' }
  | { kind: 'invalidConfig'; error: string }
  | { kind: 'nothing' }
  | { kind: 'ok'; sent: number }
  | { kind: 'failed'; error: string }

/** Kurzer Hinweis nach „Jetzt übertragen“ */
export function manualPushMessage(outcome: ManualOutcome): string {
  switch (outcome.kind) {
    case 'disabled':
      return 'Server-Push ist aus'
    case 'invalidConfig':
    case 'failed':
      return outcome.error
    case 'nothing':
      return 'Alles übertragen'
    case 'ok':
      return outcome.sent === 0 ? 'Übertragen' : `${pendingText(outcome.sent)} übertragen`
  }
}
