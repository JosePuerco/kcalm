import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { encodePng, hexToRgb, renderSplash, type Rgb } from './splash.ts'

const bg: Rgb = [243, 244, 246]
const accent: Rgb = [61, 90, 254]
const spec = { width: 60, height: 100, bg, accent, iconSize: 40 }
const px = renderSplash(spec)
const at = (x: number, y: number) => [...px.subarray((y * spec.width + x) * 3, (y * spec.width + x) * 3 + 3)]

describe('hexToRgb', () => {
  it('liest #RRGGBB, lehnt anderes ab', () => {
    expect(hexToRgb('#3D5AFE')).toEqual([61, 90, 254])
    expect(() => hexToRgb('rgba(0,0,0,1)')).toThrow()
  })
})

describe('renderSplash', () => {
  it('Hintergrund außerhalb des Icons, Akzent in der Ringmitte', () => {
    expect(at(0, 0)).toEqual([...bg])
    expect(at(59, 99)).toEqual([...bg])
    expect(at(30, 50)).toEqual([...accent])
  })

  it('Ecken des Icons abgerundet: die äußerste Ecke bleibt Hintergrund', () => {
    expect(at(10, 30)).toEqual([...bg])
  })

  it('Bogen oben weiß, Spur links durchscheinend', () => {
    // Ring bei r = 0,26 × 40 ≈ 10 px um die Mitte (30, 50)
    expect(at(30, 39)).toEqual([255, 255, 255])
    const left = at(19, 50) // 270°: außerhalb des Bogens (252°), also Spur
    expect(left[0]).toBeGreaterThan(accent[0])
    expect(left[0]).toBeLessThan(255)
  })
})

describe('encodePng', () => {
  it('schreibt Signatur, Größe und die Pixel unverändert', () => {
    const png = encodePng(spec.width, spec.height, px)
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(png.readUInt32BE(16)).toBe(60)
    expect(png.readUInt32BE(20)).toBe(100)
    const idatLen = png.readUInt32BE(33)
    expect(png.subarray(37, 41).toString('ascii')).toBe('IDAT')
    const rows = inflateSync(png.subarray(41, 41 + idatLen))
    expect(rows.length).toBe((60 * 3 + 1) * 100)
    expect([...rows.subarray(51 * (60 * 3 + 1) - 0, 51 * (60 * 3 + 1) + 1)]).toEqual([0])
    expect([...rows.subarray(50 * 181 + 1 + 30 * 3, 50 * 181 + 1 + 31 * 3)]).toEqual([...accent])
  })
})
