import { describe, expect, it } from 'vitest'
import { href, parseHash, parseSubPath } from './router.ts'

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

describe('parseSubPath', () => {
  it('liefert die Teile nach dem Screen-Namen', () => {
    expect(parseSubPath('#/lebensmittel/produkt/abc-123')).toEqual(['produkt', 'abc-123'])
    expect(parseSubPath('#/lebensmittel/produkt/abc/bearbeiten')).toEqual(['produkt', 'abc', 'bearbeiten'])
  })

  it('ohne Unterpfad leer', () => {
    expect(parseSubPath('#/lebensmittel')).toEqual([])
    expect(parseSubPath('#/lebensmittel/')).toEqual([])
    expect(parseSubPath('')).toEqual([])
  })

  it('ignoriert Parameter und doppelte Schrägstriche', () => {
    expect(parseSubPath('#/lebensmittel//neu?x=1')).toEqual(['neu'])
  })

  it('unbekannter Screen hat keinen Unterpfad', () => {
    expect(parseSubPath('#/gibtsnicht/neu')).toEqual([])
  })

  it('dekodiert Sonderzeichen und übersteht kaputte Kodierung', () => {
    expect(parseSubPath('#/lebensmittel/bls/M5B1600')).toEqual(['bls', 'M5B1600'])
    expect(parseSubPath('#/lebensmittel/x%20y')).toEqual(['x y'])
    expect(parseSubPath('#/lebensmittel/%E0')).toEqual([])
  })

  it('passt zu href mit Unterpfad', () => {
    expect(href('lebensmittel', 'produkt', 'a b')).toBe('#/lebensmittel/produkt/a%20b')
    expect(parseSubPath(href('lebensmittel', 'produkt', 'a b'))).toEqual(['produkt', 'a b'])
    expect(parseHash(href('lebensmittel', 'neu'))).toBe('lebensmittel')
  })
})
