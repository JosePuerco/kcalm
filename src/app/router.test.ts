import { describe, expect, it } from 'vitest'
import { href, parseHash } from './router.ts'

describe('parseHash', () => {
  it('erkennt bekannte Screens', () => {
    expect(parseHash('#/statistik')).toBe('statistik')
    expect(parseHash('#/einstellungen')).toBe('einstellungen')
    expect(parseHash('#vorschau')).toBe('vorschau')
  })

  it('fällt bei leerem oder unbekanntem Hash auf das Tagebuch zurück', () => {
    expect(parseHash('')).toBe('tagebuch')
    expect(parseHash('#/')).toBe('tagebuch')
    expect(parseHash('#/gibtsnicht')).toBe('tagebuch')
  })

  it('ignoriert Unterpfade und Parameter', () => {
    expect(parseHash('#/lebensmittel/123')).toBe('lebensmittel')
    expect(parseHash('#/statistik?zeitraum=woche')).toBe('statistik')
  })

  it('passt zu href', () => {
    expect(parseHash(href('lebensmittel'))).toBe('lebensmittel')
  })
})
