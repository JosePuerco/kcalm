import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { ZXING_WASM_SHA256, ZXING_WASM_VERSION } from 'barcode-detector/ponyfill'
import { describe, expect, it } from 'vitest'

const zxingDir = new URL('../node_modules/zxing-wasm/', import.meta.url)

// Der JS-Teil steckt in barcode-detector, die .wasm-Datei liefert das Paket zxing-wasm.
// Passen sie nach einem Update nicht mehr zusammen, scheitert der Scanner erst auf dem iPhone.
describe('ZXing-WASM aus dem eigenen Build', () => {
  it('Version von zxing-wasm passt zu barcode-detector', () => {
    const pkg = JSON.parse(readFileSync(new URL('package.json', zxingDir), 'utf8')) as { version: string }
    expect(pkg.version).toBe(ZXING_WASM_VERSION)
  })

  it('die .wasm-Datei ist genau die, die barcode-detector erwartet', () => {
    const wasm = readFileSync(new URL('dist/reader/zxing_reader.wasm', zxingDir))
    expect(createHash('sha256').update(wasm).digest('hex')).toBe(ZXING_WASM_SHA256)
  })
})
