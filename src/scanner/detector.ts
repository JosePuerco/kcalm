// Barcode-Leser (barcode-detector mit ZXing als WebAssembly). Safari hat keinen eingebauten.
// Die .wasm-Datei kommt aus dem eigenen Build (Vite legt sie als Datei mit Hash ab, der Service Worker
// cacht sie), nie vom CDN: so scannt Kcalm auch im Flugmodus. Wird nur mit dem Scanner geladen.

import { BarcodeDetector, prepareZXingModule } from 'barcode-detector/ponyfill'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import { BARCODE_FORMATS } from '../logic/barcode.ts'

let ready: Promise<unknown> | null = null

/** Lädt die WASM-Datei einmal pro Sitzung; nach einem Fehler beim nächsten Mal neu */
function prepare(): Promise<unknown> {
  ready ??= prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
    },
    fireImmediately: true,
  }).catch((error: unknown) => {
    ready = null
    throw error
  })
  return ready
}

export async function createDetector(): Promise<BarcodeDetector> {
  await prepare()
  return new BarcodeDetector({ formats: [...BARCODE_FORMATS] })
}
