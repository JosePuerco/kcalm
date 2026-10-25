// Erzeugt die Startbilder für das iPhone (public/splash/), hell und dunkel, aus design/tokens.json.
// Nur nötig, wenn sich Farben oder Icon ändern: npm run splash (Ergebnis wird committet).
// iOS zeigt ein Startbild nur, wenn es exakt zur Bildschirmgröße passt; die Links stehen in index.html.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { encodePng, hexToRgb, renderSplash } from './splash.ts'

const root = new URL('../', import.meta.url)
const tokens = JSON.parse(readFileSync(new URL('design/tokens.json', root), 'utf8')) as {
  color: Record<'light' | 'dark', { bg: string; accent: string }>
}

// iPhone 16e (Testgerät): 390 × 844 pt, 3-fach → 1170 × 2532 px. Icon 96 pt.
const screens = [{ width: 1170, height: 2532, iconSize: 288 }]
const modes = [
  { name: 'hell', colors: tokens.color.light },
  { name: 'dunkel', colors: tokens.color.dark },
]

const dir = new URL('public/splash/', root)
mkdirSync(dir, { recursive: true })
for (const s of screens) {
  for (const m of modes) {
    const rgb = renderSplash({ ...s, bg: hexToRgb(m.colors.bg), accent: hexToRgb(m.colors.accent) })
    const file = `splash-${s.width}x${s.height}-${m.name}.png`
    writeFileSync(new URL(file, dir), encodePng(s.width, s.height, rgb))
    console.log(`public/splash/${file}`)
  }
}
