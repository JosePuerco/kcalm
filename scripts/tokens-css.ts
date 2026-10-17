// Wandelt design/tokens.json in CSS um (Variablen pro Modus + Tailwind-@theme).
// Reine Funktion ohne Dateizugriff, damit sie testbar ist.

type ColorSet = Record<string, string>
type TypeToken = { size: number; weight: number; letterSpacing?: number }
type MotionToken = { durationMs?: number; easing?: string }

export type Tokens = {
  color: { light: ColorSet; dark: ColorSet }
  font: { family: string; fallback: string; mono: string }
  type: Record<string, TypeToken>
  radius: Record<string, number>
  space: Record<string, number>
  shadow: Record<string, string>
  motion: Record<string, MotionToken | string>
}

/** camelCase → kebab-case: accentText → accent-text */
export function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
}

/** Benannte Kurven aus tokens.json in CSS übersetzen. */
export function cssEasing(easing: string): string {
  if (easing === 'easeOutCubic') return 'cubic-bezier(.33,1,.68,1)'
  return easing
}

function colorVars(set: ColorSet, indent: string): string {
  return Object.entries(set)
    .map(([k, v]) => `${indent}--kc-${kebab(k)}: ${v};`)
    .join('\n')
}

export function tokensToCss(t: Tokens): string {
  const out: string[] = []
  out.push('/* GENERIERT aus design/tokens.json – nicht von Hand bearbeiten (npm run tokens) */')
  out.push('')

  // Farben: hell als Standard, dunkel manuell oder über das System
  out.push(':root {\n  color-scheme: light;\n' + colorVars(t.color.light, '  ') + '\n}')
  out.push(':root[data-theme="dark"] {\n  color-scheme: dark;\n' + colorVars(t.color.dark, '  ') + '\n}')
  out.push(
    '@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n    color-scheme: dark;\n' +
      colorVars(t.color.dark, '    ') +
      '\n  }\n}',
  )

  // Motion als Variablen für CSS-Übergänge (Press, Chevron, Balken …)
  const motion: string[] = []
  for (const [name, m] of Object.entries(t.motion)) {
    if (typeof m !== 'object') continue
    if (m.durationMs !== undefined) motion.push(`  --kc-motion-${kebab(name)}-duration: ${m.durationMs}ms;`)
    if (m.easing !== undefined) motion.push(`  --kc-motion-${kebab(name)}-easing: ${cssEasing(m.easing)};`)
  }
  out.push(':root {\n' + motion.join('\n') + '\n}')

  // Tailwind-Theme: Standardpaletten abschalten, nur Tokens zulassen
  const th: string[] = []
  th.push('  --color-*: initial;')
  for (const k of Object.keys(t.color.light)) th.push(`  --color-${kebab(k)}: var(--kc-${kebab(k)});`)

  th.push(`  --font-sans: '${t.font.family}', ${t.font.fallback};`)
  th.push(`  --font-mono: '${t.font.mono}', ui-monospace, monospace;`)

  th.push('  --text-*: initial;')
  for (const [k, v] of Object.entries(t.type)) {
    const n = kebab(k)
    th.push(`  --text-${n}: ${v.size}px;`)
    th.push(`  --text-${n}--line-height: normal;`)
    th.push(`  --text-${n}--font-weight: ${v.weight};`)
    if (v.letterSpacing !== undefined) th.push(`  --text-${n}--letter-spacing: ${v.letterSpacing}px;`)
  }

  th.push('  --radius-*: initial;')
  for (const [k, v] of Object.entries(t.radius)) th.push(`  --radius-${kebab(k)}: ${v}px;`)
  th.push('  --radius-full: 9999px;')

  for (const [k, v] of Object.entries(t.space)) th.push(`  --spacing-${kebab(k)}: ${v}px;`)

  th.push('  --shadow-*: initial;')
  for (const [k, v] of Object.entries(t.shadow)) th.push(`  --shadow-${kebab(k)}: ${v};`)

  out.push('@theme {\n' + th.join('\n') + '\n}')
  return out.join('\n\n') + '\n'
}
