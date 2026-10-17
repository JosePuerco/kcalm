import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import tokens from '../design/tokens.json' with { type: 'json' }
import { cssEasing, kebab, tokensToCss, type Tokens } from './tokens-css.ts'

const css = tokensToCss(tokens as Tokens)

describe('kebab', () => {
  it('wandelt camelCase um', () => {
    expect(kebab('accentText')).toBe('accent-text')
    expect(kebab('segmentTrackInCard')).toBe('segment-track-in-card')
    expect(kebab('bg')).toBe('bg')
  })
})

describe('cssEasing', () => {
  it('übersetzt easeOutCubic und lässt cubic-bezier unverändert', () => {
    expect(cssEasing('easeOutCubic')).toBe('cubic-bezier(.33,1,.68,1)')
    expect(cssEasing('cubic-bezier(.2,1.15,.35,1)')).toBe('cubic-bezier(.2,1.15,.35,1)')
  })
})

describe('tokensToCss', () => {
  it('hat für jede helle Farbe eine dunkle', () => {
    expect(Object.keys(tokens.color.dark).sort()).toEqual(Object.keys(tokens.color.light).sort())
  })

  it('schreibt jede Farbe in beide Modi und ins Tailwind-Theme', () => {
    for (const [k, v] of Object.entries(tokens.color.light)) {
      expect(css).toContain(`--kc-${kebab(k)}: ${v};`)
      expect(css).toContain(`--color-${kebab(k)}: var(--kc-${kebab(k)});`)
    }
    for (const [k, v] of Object.entries(tokens.color.dark)) {
      expect(css).toContain(`--kc-${kebab(k)}: ${v};`)
    }
  })

  it('schaltet Tailwinds eigene Paletten ab', () => {
    expect(css).toContain('--color-*: initial;')
    expect(css).toContain('--text-*: initial;')
    expect(css).toContain('--radius-*: initial;')
  })

  it('übernimmt Schriftgrößen mit Gewicht und Laufweite', () => {
    expect(css).toContain('--text-hero: 44px;')
    expect(css).toContain('--text-hero--font-weight: 600;')
    expect(css).toContain('--text-hero--letter-spacing: -1.5px;')
    expect(css).not.toContain('--text-body--letter-spacing')
  })

  it('dunkle Werte gelten manuell und per System, außer bei manuell hell', () => {
    expect(css).toContain(':root[data-theme="dark"]')
    expect(css).toContain(':root:not([data-theme="light"])')
  })
})

describe('src/styles/tokens.css', () => {
  it('ist aktuell (sonst npm run tokens)', () => {
    const file = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
    expect(file.replace(/\r\n/g, '\n')).toBe(css)
  })
})
