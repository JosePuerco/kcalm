import { describe, expect, it } from 'vitest'
import { DEFAULT_PUSH_STATE, type PushConfig } from './push.ts'
import {
  dataLocationText,
  lastSuccessText,
  manualPushMessage,
  pendingText,
  pushRowMeta,
  relativeTime,
} from './pushView.ts'

// Lokale Zeit wie in der App (Tests laufen in der Zeitzone des Rechners)
const now = new Date(2026, 10, 12, 19, 5)
const at = (d: number, h: number, m: number) => new Date(2026, 10, d, h, m).toISOString()
const on: PushConfig = { enabled: true, serverUrl: 'https://kcalm-api.dunkleschokola.de', token: 'x'.repeat(32) }

describe('relativeTime', () => {
  it('heute mit Uhrzeit, gestern, vor n Tagen, noch nie', () => {
    expect(relativeTime(at(12, 18, 42), now)).toBe('heute, 18:42')
    expect(relativeTime(at(12, 0, 1), now)).toBe('heute, 00:01')
    expect(relativeTime(at(11, 23, 59), now)).toBe('gestern')
    expect(relativeTime(at(9, 12, 0), now)).toBe('vor 3 Tagen')
    expect(relativeTime(null, now)).toBeNull()
  })

  it('Zeitpunkt in der Zukunft (Uhr verstellt) zählt als heute', () => {
    expect(relativeTime(at(14, 9, 0), now)).toBe('heute, 09:00')
  })
})

describe('pushRowMeta', () => {
  const state = { ...DEFAULT_PUSH_STATE, lastSuccessAt: at(12, 18, 42) }

  it('aus', () => {
    expect(pushRowMeta({ ...on, enabled: false }, state, 5, now)).toEqual({ text: 'Aus', warn: false })
  })

  it('an, aber Adresse oder Token fehlen → Warnung', () => {
    expect(pushRowMeta({ ...on, token: '' }, state, 0, now)).toEqual({ text: 'Nicht eingerichtet', warn: true })
  })

  it('letzter Fehler hat Vorrang und warnt', () => {
    const failed = { ...state, lastError: 'Server nicht erreichbar' }
    expect(pushRowMeta(on, failed, 3, now)).toEqual({ text: 'Server nicht erreichbar', warn: true })
  })

  it('ausstehend, übertragen, noch nie', () => {
    expect(pushRowMeta(on, state, 1234, now)).toEqual({ text: '1.234 ausstehend', warn: false })
    expect(pushRowMeta(on, state, 0, now)).toEqual({ text: 'Übertragen heute, 18:42', warn: false })
    expect(pushRowMeta(on, state, undefined, now)).toEqual({ text: 'Übertragen heute, 18:42', warn: false })
    expect(pushRowMeta(on, DEFAULT_PUSH_STATE, 0, now)).toEqual({ text: 'Noch nicht übertragen', warn: false })
  })
})

describe('Status-Texte', () => {
  it('letzte Übertragung', () => {
    expect(lastSuccessText(DEFAULT_PUSH_STATE, now)).toBe('Noch nie')
    expect(lastSuccessText({ ...DEFAULT_PUSH_STATE, lastSuccessAt: at(11, 8, 0) }, now)).toBe('gestern')
  })

  it('ausstehend mit Einzahl und Tausenderpunkt', () => {
    expect(pendingText(0)).toBe('0 Änderungen')
    expect(pendingText(1)).toBe('1 Änderung')
    expect(pendingText(2)).toBe('2 Änderungen')
    expect(pendingText(1500)).toBe('1.500 Änderungen')
  })

  it('Satz unter „Über“ je nach Schalter', () => {
    expect(dataLocationText({ ...on, enabled: false })).toBe('alle Daten bleiben auf diesem Gerät')
    expect(dataLocationText(on)).toBe('Daten liegen auf diesem Gerät und deinem eigenen Server')
  })

  it('Hinweis nach „Jetzt übertragen“', () => {
    expect(manualPushMessage({ kind: 'ok', sent: 3 })).toBe('3 Änderungen übertragen')
    expect(manualPushMessage({ kind: 'ok', sent: 1 })).toBe('1 Änderung übertragen')
    expect(manualPushMessage({ kind: 'ok', sent: 0 })).toBe('Übertragen')
    expect(manualPushMessage({ kind: 'nothing' })).toBe('Alles übertragen')
    expect(manualPushMessage({ kind: 'failed', error: 'Token wird nicht akzeptiert' })).toBe('Token wird nicht akzeptiert')
    expect(manualPushMessage({ kind: 'invalidConfig', error: 'Bitte Token eingeben' })).toBe('Bitte Token eingeben')
    expect(manualPushMessage({ kind: 'disabled' })).toBe('Server-Push ist aus')
  })
})
