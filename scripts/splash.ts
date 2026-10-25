// Startbild (Splashscreen) für die installierte App auf dem iPhone: Hintergrund aus den Tokens,
// in der Mitte das App-Icon (blaues Quadrat mit Ring wie public/icon-512.png).
// Reine Funktionen ohne Abhängigkeiten: Pixel malen und als PNG kodieren (zlib ist in Node eingebaut).
import { crc32, deflateSync } from 'node:zlib'

export type Rgb = readonly [number, number, number]

export interface SplashSpec {
  width: number
  height: number
  bg: Rgb
  accent: Rgb
  /** Kantenlänge des Icons in Pixeln */
  iconSize: number
}

// Maße des Icons relativ zur Kantenlänge, wie in public/icon-512.png und favicon.svg
const CORNER = 0.225 // Eckenradius wie iOS-App-Icons
const RING_R = 0.26
const RING_STROKE = 0.085
const ARC_DEG = 252 // Bogen im Uhrzeigersinn ab 12 Uhr
const TRACK_ALPHA = 70 / 255 // Spur: Weiß, durchscheinend
const SAMPLES = 4 // 4 × 4 Abtastpunkte pro Pixel für glatte Kanten

export function hexToRgb(hex: string): Rgb {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) throw new Error(`Keine Farbe im Format #RRGGBB: ${hex}`)
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)]
}

/** Deckung der drei Ebenen an einem Punkt (Koordinaten relativ zur Icon-Mitte, Einheit = Kantenlänge) */
function layersAt(x: number, y: number): { square: boolean; track: boolean; arc: boolean } {
  const half = 0.5
  const qx = Math.max(Math.abs(x) - (half - CORNER), 0)
  const qy = Math.max(Math.abs(y) - (half - CORNER), 0)
  const square = Math.abs(x) <= half && Math.abs(y) <= half && qx * qx + qy * qy <= CORNER * CORNER
  const d = Math.hypot(x, y)
  const track = Math.abs(d - RING_R) <= RING_STROKE / 2
  // Winkel im Uhrzeigersinn ab 12 Uhr (y wächst nach unten)
  const angle = ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360
  const end = (ARC_DEG * Math.PI) / 180
  const cap = (cx: number, cy: number) => Math.hypot(x - cx, y - cy) <= RING_STROKE / 2
  const arc =
    (track && angle <= ARC_DEG) ||
    cap(0, -RING_R) ||
    cap(Math.sin(end) * RING_R, -Math.cos(end) * RING_R)
  return { square, track, arc }
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const WHITE: Rgb = [255, 255, 255]

/** Farbe eines Pixels im Icon (Pixel-Mitte relativ zur Icon-Mitte, in Pixeln) */
function iconPixel(px: number, py: number, size: number, bg: Rgb, accent: Rgb): Rgb {
  let r = 0
  let g = 0
  let b = 0
  for (let sy = 0; sy < SAMPLES; sy++) {
    for (let sx = 0; sx < SAMPLES; sx++) {
      const x = (px + (sx + 0.5) / SAMPLES - 0.5) / size
      const y = (py + (sy + 0.5) / SAMPLES - 0.5) / size
      const l = layersAt(x, y)
      let c: Rgb = bg
      if (l.square) {
        c = accent
        if (l.arc) c = WHITE
        else if (l.track) c = mix(accent, WHITE, TRACK_ALPHA)
      }
      r += c[0]
      g += c[1]
      b += c[2]
    }
  }
  const n = SAMPLES * SAMPLES
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
}

/** Startbild als RGB-Pixel, Zeile für Zeile */
export function renderSplash({ width, height, bg, accent, iconSize }: SplashSpec): Buffer {
  const px = Buffer.alloc(width * height * 3)
  for (let i = 0; i < width * height; i++) px.set(bg, i * 3)
  const left = Math.floor((width - iconSize) / 2)
  const top = Math.floor((height - iconSize) / 2)
  for (let y = 0; y < iconSize; y++) {
    for (let x = 0; x < iconSize; x++) {
      const c = iconPixel(x + 0.5 - iconSize / 2, y + 0.5 - iconSize / 2, iconSize, bg, accent)
      px.set(c, ((top + y) * width + left + x) * 3)
    }
  }
  return px
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** RGB-Pixel als PNG (8 Bit je Kanal, ohne Filter) */
export function encodePng(width: number, height: number, rgb: Buffer): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // Bit je Kanal
  header[9] = 2 // Farbtyp RGB
  const rows = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) rgb.copy(rows, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
