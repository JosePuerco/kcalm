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
import { db } from './db.ts'
import { newRecord } from './records.ts'
import { getSetting, setSetting } from './settings.ts'
import type { Product } from './types.ts'

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
  return { kind: 'fetched', product: await saveOffProduct(result.product, now) }
}

export type OffSearch = { kind: 'results'; products: OffProduct[] } | Failure

/** Textsuche bei OFF, nur auf Knopfdruck. Treffer werden erst beim Antippen gespeichert. */
export async function searchOff(terms: string, net = browserNetwork()): Promise<OffSearch> {
  const response = await getJson(searchUrl(terms, await offApp()), net)
  if (response.kind !== 'json') return response
  const products = parseSearchResponse(response.json)
  return products === null ? { kind: 'unreachable' } : { kind: 'results', products }
}
