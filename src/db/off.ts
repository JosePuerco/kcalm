// Open Food Facts abfragen und Produkte lokal speichern (PLAN.md 2, Barcode; 3, Open Food Facts).
// Einmal geladene Produkte bleiben lokal: Ein Scan sucht zuerst hier, erst dann bei OFF.

// Benannt importiert, damit nur Name und Version in die App kommen
import { name as appName, version as appVersion } from '../../package.json'
import { barcodeVariants } from '../logic/barcode.ts'
import {
  parseProductResponse,
  parseSearchResponse,
  productUrl,
  searchUrl,
  type OffApp,
  type OffProduct,
} from '../logic/off.ts'
import { rebaseOnOffUpdate } from '../logic/verify.ts'
import { db } from './db.ts'
import { newRecord, touch } from './records.ts'
import { getSetting, setSetting } from './settings.ts'
import type { FoodRef, Product } from './types.ts'
import { getOverride, putOverride } from './verify.ts'

export const APP_UUID_KEY = 'offAppUuid'
/** Danach gilt OFF als nicht erreichbar */
const TIMEOUT_MS = 8000

/** App-Kennung für OFF; die UUID wird beim ersten Mal erzeugt und bleibt */
export async function offApp(): Promise<OffApp> {
  let uuid = await getSetting<string>(APP_UUID_KEY)
  if (!uuid) {
    uuid = crypto.randomUUID()
    await setSetting(APP_UUID_KEY, uuid)
  }
  return { name: appName, version: appVersion, uuid }
}

/** Austauschbar für Tests */
export interface Network {
  fetch: typeof fetch
  isOnline: () => boolean
  timeoutMs: number
  /** Warten zwischen zwei Versuchen (Tests: sofort) */
  wait?: (ms: number) => Promise<void>
}

const browserNetwork = (): Network => ({
  fetch: (...args) => fetch(...args),
  isOnline: () => navigator.onLine,
  timeoutMs: TIMEOUT_MS,
})

/** offline = kein Netz; unreachable = Netz da, aber OFF antwortet nicht (Fehler, 503, Zeitlimit) */
type Failure = { kind: 'offline' } | { kind: 'unreachable' }

async function getJson(url: string, net: Network): Promise<{ kind: 'json'; json: unknown } | Failure> {
  if (!net.isOnline()) return { kind: 'offline' }
  let response: Response
  try {
    response = await net.fetch(url, { signal: AbortSignal.timeout(net.timeoutMs) })
  } catch {
    return net.isOnline() ? { kind: 'unreachable' } : { kind: 'offline' }
  }
  // 404 gehört dazu: so meldet OFF „Produkt nicht gefunden“
  if (response.status !== 200 && response.status !== 404) return { kind: 'unreachable' }
  try {
    return { kind: 'json', json: await response.json() }
  } catch {
    return { kind: 'unreachable' }
  }
}

/** Lokales Produkt zum Barcode (Einheitsform); nicht archivierte zuerst */
export async function findProductByBarcode(barcode: string): Promise<Product | undefined> {
  const products = await db.products
    .where('barcode')
    .anyOf(barcodeVariants(barcode))
    .filter((p) => p.deletedAt === null)
    .toArray()
  return products.find((p) => !p.archived) ?? products[0]
}

/** Speichert ein OFF-Produkt; gibt es den Barcode schon lokal, bleibt das vorhandene */
export async function saveOffProduct(data: OffProduct, now = new Date()): Promise<Product> {
  return db.transaction('rw', db.products, async () => {
    const existing = data.barcode === null ? undefined : await findProductByBarcode(data.barcode)
    if (existing) return existing
    const product = newRecord<Product>(
      {
        ...data,
        source: 'off',
        useOverride: true,
        archived: false,
        offFetchedAt: now.toISOString(),
        price: null,
      },
      now,
    )
    await db.products.add(product)
    return product
  })
}

export type BarcodeLookup =
  | { kind: 'local'; product: Product }
  | { kind: 'fetched'; product: Product }
  | { kind: 'notFound' }
  /** Bei OFF, aber ohne kcal: wird nicht gespeichert, sondern als eigenes Produkt angelegt (Jan, 21.10.2026) */
  | { kind: 'noNutrients'; data: OffProduct }
  | Failure

/** Scan auswerten: lokal, sonst OFF (Treffer wird gespeichert). barcode in Einheitsform. */
export async function lookupBarcode(barcode: string, net = browserNetwork(), now = new Date()): Promise<BarcodeLookup> {
  const local = await findProductByBarcode(barcode)
  if (local) return { kind: 'local', product: local }

  const response = await getJson(productUrl(barcode, await offApp()), net)
  if (response.kind !== 'json') return response
  const result = parseProductResponse(response.json, barcode)
  if (result.kind === 'notFound') return result
  if (result.kind === 'invalid') return { kind: 'unreachable' }
  if (result.product.per100.kcal === null) return { kind: 'noNutrients', data: result.product }
  return { kind: 'fetched', product: await saveOffProduct(result.product, now) }
}

export type OffRefresh =
  | { kind: 'updated'; product: Product }
  | { kind: 'notFound' }
  /** OFF liefert keine kcal mehr: Original bleibt wie es ist */
  | { kind: 'noNutrients' }
  | Failure

/**
 * „Original jetzt aktualisieren“: Name, Marke und Nährwerte neu von OFF.
 * Die Korrektur wird nicht überschrieben; was OFF ändert, hält sie mit dem alten Wert fest,
 * damit „Meine Werte“ gleich bleiben (rebaseOnOffUpdate). Portionen bleiben.
 */
export async function refreshOffProduct(id: string, net = browserNetwork(), now = new Date()): Promise<OffRefresh> {
  const product = await db.products.get(id)
  if (!product || product.deletedAt !== null || product.source !== 'off' || product.barcode === null) {
    throw new Error(`Kein OFF-Produkt: ${id}`)
  }
  const response = await getJson(productUrl(product.barcode, await offApp()), net)
  if (response.kind !== 'json') return response
  const result = parseProductResponse(response.json, product.barcode)
  if (result.kind === 'notFound') return result
  if (result.kind === 'invalid') return { kind: 'unreachable' }
  if (result.product.per100.kcal === null) return { kind: 'noNutrients' }
  const fresh = result.product

  return db.transaction('rw', db.products, db.productOverrides, async () => {
    // Neu lesen: Während der Abfrage kann sich lokal etwas geändert haben
    const current = await db.products.get(id)
    if (!current) throw new Error(`Produkt fehlt: ${id}`)
    const ref: FoodRef = `product:${id}`
    const override = await getOverride(ref)
    if (override) {
      await putOverride(ref, rebaseOnOffUpdate(current.per100, fresh.per100, override.per100), override.verifiedAt, now)
    }
    const changes = { name: fresh.name, brand: fresh.brand, per100: fresh.per100, offFetchedAt: now.toISOString() }
    const updated = touch(current, changes, now)
    await db.products.put(updated)
    return { kind: 'updated' as const, product: updated }
  })
}

export type OffSearch = { kind: 'results'; products: OffProduct[] } | Failure

/**
 * Wartezeiten vor dem 2. und 3. Versuch. Die Textsuche antwortet oft mit 503 (Stand 21.10.2026 etwa
 * drei von vier Anfragen); kurz danach klappt es meist. Höchstens 3 Anfragen je Tipp, OFF erlaubt 10 pro Minute.
 */
export const SEARCH_RETRY_MS = [1000, 2000]

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Textsuche bei OFF, nur auf Knopfdruck. Treffer werden erst beim Antippen gespeichert. */
export async function searchOff(terms: string, net = browserNetwork()): Promise<OffSearch> {
  const url = searchUrl(terms, await offApp())
  const wait = net.wait ?? sleep
  for (let attempt = 0; ; attempt++) {
    const response = await getJson(url, net)
    if (response.kind === 'json') {
      const products = parseSearchResponse(response.json)
      if (products !== null) return { kind: 'results', products }
    }
    // Ohne Netz hilft Warten nicht
    if (response.kind === 'offline') return response
    const delay = SEARCH_RETRY_MS[attempt]
    if (delay === undefined) return { kind: 'unreachable' }
    await wait(delay)
  }
}
