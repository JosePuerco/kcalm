import { describe, expect, it } from 'vitest'
import {
  KJ_PER_KCAL,
  looseNumber,
  offResultLabels,
  offNutrients,
  parseProductResponse,
  parseSearchResponse,
  productUrl,
  searchUrl,
  UNNAMED_PRODUCT,
  type OffApp,
} from './off.ts'

const app: OffApp = { name: 'kcalm', version: '0.1.0', uuid: '7c9e6679-7425-40de-944b-e07fc1f90ae7' }

// Echte Antwort aus dem Kurztest (21.10.2026), gekürzt
const marzipan = {
  code: '4000417025005',
  status: 1,
  status_verbose: 'product found',
  product: {
    brands: 'Ritter Sport',
    code: '4000417025005',
    nutriments: {
      'energy-kcal_100g': 496,
      'energy-kj_100g': 2069,
      energy_100g: 2069,
      fat_100g: 27,
      'saturated-fat_100g': 11,
      carbohydrates_100g: 52,
      sugars_100g: 51,
      fiber_100g: 6.2,
      proteins_100g: 7,
      salt_100g: 1,
      sodium_100g: 0.4,
      alcohol_100g: 0,
      'nova-group_100g': 4,
    },
    nutrition_data_per: '100g',
    product_name: 'Marzipane chocolate',
    product_name_de: 'Marzipan',
    product_quantity: 100,
    product_quantity_unit: 'g',
    quantity: '100g',
    serving_quantity: 6.52,
    serving_size: '1 Cube (6.52 g)',
  },
}

const notFound = { code: '4000000000000', status: 0, status_verbose: 'product not found' }

/** Antwort mit geändertem Produkt */
function withProduct(changes: Record<string, unknown>) {
  return { ...marzipan, product: { ...marzipan.product, ...changes } }
}

describe('Adressen', () => {
  it('Produktabfrage mit Feldern und App-Kennung', () => {
    const url = new URL(productUrl('4000417025005', app))
    expect(url.origin + url.pathname).toBe('https://world.openfoodfacts.org/api/v2/product/4000417025005.json')
    expect(url.searchParams.get('app_name')).toBe('kcalm')
    expect(url.searchParams.get('app_version')).toBe('0.1.0')
    expect(url.searchParams.get('app_uuid')).toBe(app.uuid)
    expect(url.searchParams.get('fields')?.split(',')).toContain('nutriments')
  })

  it('Textsuche über search.pl, Suchbegriff sauber kodiert', () => {
    const url = new URL(searchUrl('  Skyr & Quark ', app))
    expect(url.pathname).toBe('/cgi/search.pl')
    expect(url.searchParams.get('search_terms')).toBe('Skyr & Quark')
    expect(url.searchParams.get('json')).toBe('1')
    expect(url.searchParams.get('app_uuid')).toBe(app.uuid)
  })
})

describe('looseNumber', () => {
  it('nimmt Zahlen und Zahlen als Text, auch mit Komma', () => {
    expect(looseNumber(4.5)).toBe(4.5)
    expect(looseNumber(0)).toBe(0)
    expect(looseNumber('4.5')).toBe(4.5)
    expect(looseNumber(' 4,5 ')).toBe(4.5)
  })

  it('alles andere wird null, nie 0', () => {
    for (const v of [undefined, null, '', 'n/a', '<0,5', '1.000,5', -1, Number.NaN, Infinity, true, {}, []]) {
      expect(looseNumber(v)).toBeNull()
    }
  })
})

describe('offNutrients', () => {
  it('übernimmt die _100g-Werte', () => {
    expect(offNutrients(marzipan.product.nutriments)).toEqual({
      kcal: 496,
      fat: 27,
      satFat: 11,
      carbs: 52,
      sugar: 51,
      fiber: 6.2,
      protein: 7,
      salt: 1,
    })
  })

  it('kcal fehlt: aus kJ umgerechnet, exakt', () => {
    expect(offNutrients({ 'energy-kj_100g': 2069 }).kcal).toBe(2069 / KJ_PER_KCAL)
    expect(offNutrients({ energy_100g: 418.4 }).kcal).toBeCloseTo(100, 10)
  })

  it('kcal vom Etikett hat Vorrang vor kJ, auch 0', () => {
    expect(offNutrients({ 'energy-kcal_100g': 0, 'energy-kj_100g': 5 }).kcal).toBe(0)
  })

  it('Salz fehlt: aus Natrium × 2,5', () => {
    expect(offNutrients({ sodium_100g: 0.4 }).salt).toBeCloseTo(1, 10)
    expect(offNutrients({ salt_100g: 0, sodium_100g: 0.4 }).salt).toBe(0)
  })

  it('fehlende oder kaputte Werte bleiben null, nie 0', () => {
    const n = offNutrients({ fat_100g: 'unbekannt', sugars_100g: -2 })
    expect(Object.values(n).every((v) => v === null)).toBe(true)
  })

  it('unmögliche Werte (Tippfehler bei OFF) werden null', () => {
    const n = offNutrients({ 'energy-kcal_100g': 4960, fat_100g: 270, proteins_100g: 100, sodium_100g: 50 })
    expect(n.kcal).toBeNull()
    expect(n.fat).toBeNull()
    expect(n.protein).toBe(100)
    expect(n.salt).toBeNull()
  })

  it('Werte pro Portion (_serving) werden nicht genommen', () => {
    expect(offNutrients({ fat_serving: 3 }).fat).toBeNull()
  })
})

describe('parseProductResponse', () => {
  it('Treffer → Kcalm-Produkt', () => {
    expect(parseProductResponse(marzipan, '4000417025005')).toEqual({
      kind: 'found',
      product: {
        barcode: '4000417025005',
        name: 'Marzipan',
        brand: 'Ritter Sport',
        unit: 'g',
        per100: offNutrients(marzipan.product.nutriments),
        portions: [{ label: '1 Portion', amount: 6.52 }, { label: '1 Packung', amount: 100 }],
      },
    })
  })

  it('nicht gefunden (status 0, kommt mit HTTP 404)', () => {
    expect(parseProductResponse(notFound, '4000000000000')).toEqual({ kind: 'notFound' })
  })

  it('unbrauchbare Antwort', () => {
    for (const json of [null, 'Fehler', [], {}, { status: 2 }, { status: 1 }, { status: '1', product: {} }]) {
      expect(parseProductResponse(json, '4000417025005')).toEqual({ kind: 'invalid' })
    }
  })

  it('übernimmt den gescannten Code, nicht den von OFF', () => {
    const r = parseProductResponse(withProduct({ code: '36000291452' }), '0036000291452')
    expect(r.kind === 'found' && r.product.barcode).toBe('0036000291452')
  })

  const product = (changes: Record<string, unknown>) => {
    const r = parseProductResponse(withProduct(changes), '4000417025005')
    if (r.kind !== 'found') throw new Error('nicht gefunden')
    return r.product
  }

  it('Name: deutsch, sonst Original, sonst Gattung, sonst Platzhalter', () => {
    expect(product({ product_name_de: '  ' }).name).toBe('Marzipane chocolate')
    expect(product({ product_name_de: null, product_name: '', generic_name_de: 'Schokolade' }).name).toBe(
      'Schokolade',
    )
    expect(product({ product_name_de: undefined, product_name: undefined }).name).toBe(UNNAMED_PRODUCT)
  })

  it('Marke: erste von mehreren, leer → null', () => {
    expect(product({ brands: 'Ritter Sport, Alfred Ritter' }).brand).toBe('Ritter Sport')
    expect(product({ brands: '' }).brand).toBeNull()
    expect(product({ brands: 42 }).brand).toBeNull()
  })

  it('Einheit ml bei Angabe pro 100 ml oder Packung in ml/cl/l', () => {
    expect(product({ nutrition_data_per: '100ml' }).unit).toBe('ml')
    expect(product({ product_quantity_unit: 'ml' }).unit).toBe('ml')
    expect(product({ product_quantity_unit: 'L' }).unit).toBe('ml')
    expect(product({ product_quantity_unit: undefined }).unit).toBe('g')
  })

  it('Portionen: nur sinnvolle, Packung nicht doppelt', () => {
    expect(product({ serving_quantity: 100 }).portions).toEqual([{ label: '1 Portion', amount: 100 }])
    expect(product({ serving_quantity: 0, product_quantity: '500' }).portions).toEqual([
      { label: '1 Packung', amount: 500 },
    ])
    expect(product({ serving_quantity: undefined, product_quantity: 25000 }).portions).toEqual([])
  })

  it('ohne Nährwerte: Produkt bleibt, alle Werte unbekannt', () => {
    const p = product({ nutriments: undefined })
    expect(Object.values(p.per100).every((v) => v === null)).toBe(true)
  })
})

describe('parseSearchResponse', () => {
  it('wandelt Treffer um, normalisiert den Code und lässt Namenlose aus', () => {
    const json = {
      count: 3,
      products: [
        { ...marzipan.product, code: '036000291452' },
        { code: '4000417025005', product_name: '' },
        'kaputt',
        { ...marzipan.product, code: 'abc' },
      ],
    }
    const products = parseSearchResponse(json)
    expect(products?.map((p) => [p.name, p.barcode])).toEqual([
      ['Marzipan', '0036000291452'],
      ['Marzipan', 'abc'],
    ])
  })

  it('leere Suche und unbrauchbare Antwort', () => {
    expect(parseSearchResponse({ count: 0, products: [] })).toEqual([])
    expect(parseSearchResponse('<!DOCTYPE html>')).toBeNull()
    expect(parseSearchResponse({ products: 'x' })).toBeNull()
  })
})

describe('offResultLabels', () => {
  it('Marke · Quelle und kcal pro 100', () => {
    const r = parseProductResponse(marzipan, '4000417025005')
    if (r.kind !== 'found') throw new Error('nicht gefunden')
    expect(offResultLabels(r.product)).toEqual({ meta: 'Ritter Sport · Open Food Facts', kcal: '496 kcal/100 g' })
    const noBrand = { ...r.product, brand: null, unit: 'ml' as const, per100: { ...r.product.per100, kcal: null } }
    expect(offResultLabels(noBrand)).toEqual({ meta: 'Open Food Facts', kcal: '– kcal/100 ml' })
  })
})
