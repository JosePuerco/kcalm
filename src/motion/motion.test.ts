import { describe, expect, it } from 'vitest'
import tokens from '../../design/tokens.json'
import { motionTokens, parseEasing } from './motion.ts'

describe('parseEasing', () => {
  it('liest cubic-bezier aus den Tokens', () => {
    expect(parseEasing('cubic-bezier(.2,1.15,.35,1)')).toEqual([0.2, 1.15, 0.35, 1])
    expect(parseEasing('cubic-bezier( .4, 0, 1, 1 )')).toEqual([0.4, 0, 1, 1])
  })

  it('übersetzt benannte Kurven', () => {
    expect(parseEasing('easeOutCubic')).toEqual([0.33, 1, 0.68, 1])
    expect(parseEasing('ease')).toEqual([0.25, 0.1, 0.25, 1])
  })

  it('wirft bei Unsinn', () => {
    expect(() => parseEasing('cubic-bezier(1,2)')).toThrow()
    expect(() => parseEasing('bouncy')).toThrow()
  })

  it('kann jede Kurve aus tokens.json lesen', () => {
    for (const t of Object.values(tokens.motion)) {
      if (typeof t === 'object' && 'easing' in t) expect(() => parseEasing(t.easing)).not.toThrow()
    }
  })
})

describe('motionTokens', () => {
  it('rechnet Millisekunden in Sekunden um', () => {
    expect(motionTokens.sheetIn.duration).toBe(0.42)
    expect(motionTokens.sheetOut.duration).toBe(0.22)
    expect(motionTokens.toastVisibleMs).toBe(2200)
  })
})
