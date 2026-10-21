import { describe, expect, it } from 'vitest'
import { pendingCountLabel, pendingStatus, rememberedFor } from './pendingScan.ts'

describe('rememberedFor', () => {
  it('heute, gestern, morgen klein wie im Prototyp', () => {
    expect(rememberedFor('Abend', '2026-10-21', '2026-10-21')).toBe('Abend · heute')
    expect(rememberedFor('Mittag', '2026-10-20', '2026-10-21')).toBe('Mittag · gestern')
    expect(rememberedFor('Frühstück', '2026-10-22', '2026-10-21')).toBe('Frühstück · morgen')
  })

  it('sonst mit Datum', () => {
    expect(rememberedFor('Abend', '2026-10-14', '2026-10-21')).toBe('Abend · Mi 14.10.')
  })

  it('ohne Slot nur der Tag', () => {
    expect(rememberedFor(null, '2026-10-21', '2026-10-21')).toBe('heute')
  })
})

describe('pendingCountLabel', () => {
  it('Einzahl und Mehrzahl', () => {
    expect(pendingCountLabel(1)).toBe('1 gemerkter Scan')
    expect(pendingCountLabel(2)).toBe('2 gemerkte Scans')
  })
})

describe('pendingStatus', () => {
  it('lokales Produkt geht vor', () => {
    expect(pendingStatus(true, 'notFound', true)).toBe('ready')
  })

  it('Ergebnis des Nachladens, sonst lädt / wartet', () => {
    expect(pendingStatus(false, 'notFound', false)).toBe('notFound')
    expect(pendingStatus(false, 'noNutrients', true)).toBe('noNutrients')
    expect(pendingStatus(false, undefined, true)).toBe('loading')
    expect(pendingStatus(false, undefined, false)).toBe('waiting')
  })
})
