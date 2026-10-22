import 'fake-indexeddb/auto' // IndexedDB in Node nachbilden, vor dem Import von db
import { beforeEach, describe, expect, it } from 'vitest'
import { WEIGHT_HEADER } from '../logic/weightImport.ts'
import { db } from './db.ts'
import {
  deleteWeight,
  getEstimateEnabled,
  getWeights,
  importWeights,
  setEstimateEnabled,
  setManualWeight,
} from './weights.ts'

const t0 = new Date('2026-10-22T08:00:00.000Z')
const t1 = new Date('2026-10-22T09:00:00.000Z')
const text = (...lines: string[]) => [WEIGHT_HEADER, ...lines].join('\n')

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('Schalter Verbrauchsschätzung', () => {
  it('aus, solange nichts gesetzt ist; an und wieder aus', async () => {
    expect(await getEstimateEnabled()).toBe(false)
    await setEstimateEnabled(true, t0)
    expect(await getEstimateEnabled()).toBe(true)
    await setEstimateEnabled(false, t1)
    expect(await getEstimateEnabled()).toBe(false)
  })

  it('Ausschalten lässt die Gewichte stehen', async () => {
    await setManualWeight('2026-10-22', 74.8, t0)
    await setEstimateEnabled(false, t1)
    expect(await getWeights()).toHaveLength(1)
  })
})

describe('importWeights', () => {
  it('speichert einen Wert pro Tag und meldet die Zahlen', async () => {
    const r = await importWeights(
      text('2026-10-21T07:00:00+02:00;75,0;kg', '2026-10-22T07:12:00+02:00;74,8;kg', '2026-10-22T20:00:00+02:00;75,9;kg'),
      t0,
    )
    expect(r).toEqual({ ok: true, read: 3, created: 2, updated: 0, duplicates: 1 })
    expect((await getWeights()).map((w) => [w.date, w.kg, w.source])).toEqual([
      ['2026-10-21', 75, 'health'],
      ['2026-10-22', 74.8, 'health'],
    ])
  })

  it('wiederholter Import legt nichts doppelt an', async () => {
    const input = text('2026-10-22T07:12:00+02:00;74,8;kg')
    await importWeights(input, t0)
    expect(await importWeights(input, t1)).toEqual({ ok: true, read: 1, created: 0, updated: 0, duplicates: 0 })
    expect(await db.weights.count()).toBe(1)
  })

  it('Fehler im Text: nichts wird gespeichert', async () => {
    const r = await importWeights(text('2026-10-22T07:12:00+02:00;74,8;kg', 'kaputt'), t0)
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('Zeile 3') })
    expect(await db.weights.count()).toBe(0)
  })

  it('gelöschter Tag kommt beim nächsten Import nicht zurück', async () => {
    const input = text('2026-10-22T07:12:00+02:00;74,8;kg')
    await importWeights(input, t0)
    const [w] = await getWeights()
    await deleteWeight(w!.id, t1)
    expect(await importWeights(input, t1)).toMatchObject({ created: 0 })
    expect(await getWeights()).toEqual([])
  })
})

describe('setManualWeight', () => {
  it('legt einen Tag an', async () => {
    await setManualWeight('2026-10-22', 74.8, t0)
    const [w] = await getWeights()
    expect(w).toMatchObject({
      date: '2026-10-22',
      kg: 74.8,
      source: 'manual',
      measuredAt: new Date(2026, 9, 22).toISOString(),
      createdAt: t0.toISOString(),
    })
  })

  it('ersetzt den Wert eines Tages, und ein späterer Import aus Health überschreibt die Eingabe nicht', async () => {
    await importWeights(text('2026-10-22T07:12:00+02:00;74,8;kg'), t0)
    await setManualWeight('2026-10-22', 74.2, t1)
    expect((await getWeights()).map((w) => [w.kg, w.source])).toEqual([[74.2, 'manual']])
    expect(await db.weights.count()).toBe(1)
    await importWeights(text('2026-10-22T07:12:00+02:00;74,8;kg'), t1)
    expect((await getWeights()).map((w) => w.kg)).toEqual([74.2])
  })

  it('nach dem Löschen wird der Tag neu angelegt', async () => {
    await setManualWeight('2026-10-22', 74.8, t0)
    await deleteWeight((await getWeights())[0]!.id, t1)
    await setManualWeight('2026-10-22', 75, t1)
    expect((await getWeights()).map((w) => w.kg)).toEqual([75])
    expect(await db.weights.count()).toBe(2)
  })

  it('unplausible Werte werden abgelehnt', async () => {
    await expect(setManualWeight('2026-10-22', 7.48, t0)).rejects.toThrow(RangeError)
    await expect(setManualWeight('2026-10-22', Number.NaN, t0)).rejects.toThrow(RangeError)
    expect(await db.weights.count()).toBe(0)
  })
})

describe('deleteWeight', () => {
  it('setzt den Löschmarker statt echt zu löschen', async () => {
    await setManualWeight('2026-10-22', 74.8, t0)
    const [w] = await getWeights()
    await deleteWeight(w!.id, t1)
    expect(await getWeights()).toEqual([])
    expect(await db.weights.get(w!.id)).toMatchObject({ deletedAt: t1.toISOString(), updatedAt: t1.toISOString() })
  })
})
