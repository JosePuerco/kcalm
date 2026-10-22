import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductFormData } from '../logic/productForm.ts'
import { db } from './db.ts'
import { APP_UUID_KEY, findProductByBarcode, lookupBarcode, offApp, saveOffProduct, searchOff, type Network } from './off.ts'
import { archiveProduct, createProduct, deleteProduct } from './products.ts'
import { unknownNutrients } from './records.ts'
import { getSetting } from './settings.ts'

const NOW = new Date('2026-10-21T12:00:00.000Z')

const skyr = {
  status: 1,
  product: {
    code: '4002971243802',
    product_name: 'Skyr natur',
    brands: 'Milbona',
    product_quantity: 500,
    product_quantity_unit: 'g',
    nutriments: { 'energy-kcal_100g': 63, fat_100g: 0.2, proteins_100g: 11 },
  },
}

/** Netz-Attrappe: antwortet mit body und status, oder wirft (kein Netz) */
function network(answer: { status?: number; body?: unknown; text?: string } | 'throws', online = true) {
  const fetchMock = vi.fn<typeof fetch>(async () => {
    if (answer === 'throws') throw new TypeError('Load failed')
    const body = answer.text ?? JSON.stringify(answer.body)
    return new Response(body, { status: answer.status ?? 200 })
  })
  const net: Network = { fetch: fetchMock, isOnline: () => online, timeoutMs: 1000 }
  return { net, fetchMock }
}

function ownProduct(barcode: string | null): ProductFormData {
  return {
    name: 'Eigener Skyr',
    brand: null,
    barcode,
    unit: 'g',
    per100: { ...unknownNutrients(), kcal: 60 },
    portions: [],
  }
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('offApp', () => {
  it('Name und Version aus package.json, UUID einmal erzeugt und gespeichert', async () => {
    const first = await offApp()
    expect(first.name).toBe('kcalm')
    expect(first.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(first.uuid).toMatch(/^[0-9a-f-]{36}$/)
    expect((await offApp()).uuid).toBe(first.uuid)
    expect(await getSetting(APP_UUID_KEY)).toBe(first.uuid)
  })
})

describe('lookupBarcode', () => {
  it('Treffer bei OFF wird lokal gespeichert, mit App-Kennung abgefragt', async () => {
    const { net, fetchMock } = network({ body: skyr })
    const result = await lookupBarcode('4002971243802', net, NOW)

    expect(result.kind).toBe('fetched')
    if (result.kind !== 'fetched') return
    expect(result.product).toMatchObject({
      source: 'off',
      barcode: '4002971243802',
      name: 'Skyr natur',
      brand: 'Milbona',
      offFetchedAt: NOW.toISOString(),
      useOverride: true,
      archived: false,
    })
    expect(result.product.per100.kcal).toBe(63)
    expect(result.product.per100.salt).toBeNull()
    expect(await db.products.count()).toBe(1)

    const url = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(url.pathname).toBe('/api/v2/product/4002971243802.json')
    expect(url.searchParams.get('app_uuid')).toBe((await offApp()).uuid)
  })

  it('zweiter Scan kommt lokal, ohne Netz', async () => {
    await lookupBarcode('4002971243802', network({ body: skyr }).net, NOW)
    const { net, fetchMock } = network('throws', false)
    const result = await lookupBarcode('4002971243802', net)
    expect(result.kind).toBe('local')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('eigenes Produkt mit dem Barcode hat Vorrang, auch als UPC-A ohne führende 0 eingetippt', async () => {
    await createProduct(ownProduct('036000291452'))
    const { net, fetchMock } = network({ body: skyr })
    const result = await lookupBarcode('0036000291452', net)
    expect(result.kind === 'local' && result.product.name).toBe('Eigener Skyr')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('gelöschte Produkte zählen nicht, archivierte schon', async () => {
    const deleted = await createProduct(ownProduct('4002971243802'))
    await deleteProduct(deleted.id)
    expect(await findProductByBarcode('4002971243802')).toBeUndefined()

    const archived = await createProduct(ownProduct('4002971243802'))
    await archiveProduct(archived.id)
    expect((await findProductByBarcode('4002971243802'))?.id).toBe(archived.id)
  })

  it('ohne kcal: nicht gespeichert, Daten zum Vorbefüllen zurück', async () => {
    const noKcal = { ...skyr, product: { ...skyr.product, nutriments: { proteins_100g: 11 } } }
    const result = await lookupBarcode('4002971243802', network({ body: noKcal }).net)
    expect(result.kind).toBe('noNutrients')
    expect(result.kind === 'noNutrients' && [result.data.name, result.data.per100.protein]).toEqual(['Skyr natur', 11])
    expect(await db.products.count()).toBe(0)
  })

  it('nicht gefunden: HTTP 404 mit status 0, nichts gespeichert', async () => {
    const { net } = network({ status: 404, body: { status: 0, status_verbose: 'product not found' } })
    expect(await lookupBarcode('4000000000006', net)).toEqual({ kind: 'notFound' })
    expect(await db.products.count()).toBe(0)
  })

  it('offline: gar nicht erst abfragen', async () => {
    const { net, fetchMock } = network({ body: skyr }, false)
    expect(await lookupBarcode('4002971243802', net)).toEqual({ kind: 'offline' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Netzfehler: offline oder nicht erreichbar, je nach Netzstatus', async () => {
    expect(await lookupBarcode('4002971243802', network('throws', true).net)).toEqual({ kind: 'unreachable' })
    let online = true
    const { net } = network('throws')
    net.isOnline = () => {
      const was = online
      online = false // Netz fällt während der Abfrage weg
      return was
    }
    expect(await lookupBarcode('4002971243802', net)).toEqual({ kind: 'offline' })
  })

  it('503 mit HTML-Seite, unbrauchbare Antwort, Zeitlimit: nicht erreichbar', async () => {
    const html = network({ status: 503, text: '<!DOCTYPE html><title>Page temporarily unavailable</title>' })
    expect(await lookupBarcode('4002971243802', html.net)).toEqual({ kind: 'unreachable' })
    expect(await lookupBarcode('4002971243802', network({ text: 'kein json' }).net)).toEqual({ kind: 'unreachable' })
    expect(await lookupBarcode('4002971243802', network({ body: { status: 1 } }).net)).toEqual({ kind: 'unreachable' })

    const slow: Network = {
      fetch: ((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('timeout', 'TimeoutError')))
        })) as typeof fetch,
      isOnline: () => true,
      timeoutMs: 20,
    }
    expect(await lookupBarcode('4002971243802', slow)).toEqual({ kind: 'unreachable' })
    expect(await db.products.count()).toBe(0)
  })
})

describe('saveOffProduct', () => {
  it('legt keinen zweiten Datensatz zum selben Barcode an', async () => {
    const own = await createProduct(ownProduct('4002971243802'))
    const result = await lookupBarcode('4002971243802', network({ body: skyr }).net)
    expect(result.kind === 'local' && result.product.id).toBe(own.id)

    const saved = await saveOffProduct({ ...ownProduct('4002971243802'), name: 'OFF' })
    expect(saved.id).toBe(own.id)
    expect(await db.products.count()).toBe(1)
  })

  it('Suchtreffer ohne Barcode wird trotzdem gespeichert', async () => {
    const saved = await saveOffProduct({ ...ownProduct(null) }, NOW)
    expect(saved).toMatchObject({ source: 'off', barcode: null, offFetchedAt: NOW.toISOString() })
  })
})

describe('searchOff', () => {
  it('liefert umgewandelte Treffer und speichert nichts', async () => {
    const { net, fetchMock } = network({ body: { count: 1, products: [skyr.product] } })
    const result = await searchOff('skyr', net)
    expect(result.kind === 'results' && result.products.map((p) => p.name)).toEqual(['Skyr natur'])
    expect(await db.products.count()).toBe(0)
    expect(new URL(String(fetchMock.mock.calls[0]![0])).searchParams.get('search_terms')).toBe('skyr')
  })

  it('503 (laut Kurztest häufig): zwei Wiederholungen mit Pause, dann nicht erreichbar', async () => {
    const { net, fetchMock } = network({ status: 503, text: '<html>' })
    const waits: number[] = []
    net.wait = async (ms) => void waits.push(ms)
    expect(await searchOff('skyr', net)).toEqual({ kind: 'unreachable' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(waits).toEqual([1000, 2000])
  })

  it('zweiter Versuch klappt', async () => {
    let calls = 0
    const net: Network = {
      fetch: async () =>
        ++calls === 1
          ? new Response('<html>', { status: 503 })
          : new Response(JSON.stringify({ products: [skyr.product] }), { status: 200 }),
      isOnline: () => true,
      timeoutMs: 1000,
      wait: async () => undefined,
    }
    const result = await searchOff('skyr', net)
    expect(result.kind === 'results' && result.products.length).toBe(1)
    expect(calls).toBe(2)
  })

  it('offline: kein Versuch, keine Wiederholung', async () => {
    const { net, fetchMock } = network({ body: {} }, false)
    expect(await searchOff('skyr', net)).toEqual({ kind: 'offline' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
