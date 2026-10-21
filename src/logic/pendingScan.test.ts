import { describe, expect, it } from 'vitest'
import { rememberedFor } from './pendingScan.ts'

describe('rememberedFor', () => {
  it('heute, gestern, morgen klein wie im Prototyp', () => {
    expect(rememberedFor('Abend', '2026-10-21', '2026-10-21')).toBe('Abend · heute')
    expect(rememberedFor('Mittag', '2026-10-20', '2026-10-21')).toBe('Mittag · gestern')
    expect(rememberedFor('Frühstück', '2026-10-22', '2026-10-21')).toBe('Frühstück · morgen')
  })

  it('sonst mit Datum', () => {
    expect(rememberedFor('Abend', '2026-10-14', '2026-10-21')).toBe('Abend · Mi 14.10.')
  })
})
