// Erzeugt src/styles/tokens.css aus design/tokens.json.
// Läuft automatisch vor dev, build und test (siehe package.json).
import { readFileSync, writeFileSync } from 'node:fs'
import { tokensToCss, type Tokens } from './tokens-css.ts'

const root = new URL('../', import.meta.url)
const tokens = JSON.parse(readFileSync(new URL('design/tokens.json', root), 'utf8')) as Tokens
const target = new URL('src/styles/tokens.css', root)

writeFileSync(target, tokensToCss(tokens))
console.log('tokens.css aktualisiert')
