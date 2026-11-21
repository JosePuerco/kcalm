import { describe, expect, it } from 'vitest'
import { newRecord, softDelete } from '../db/records.ts'
import type { Weight } from '../db/types.ts'
import { parseWeightList, reconcileWeights, type WeightList } from './garminWeights.ts'

const T0 = new Date('2026-10-26T10:00:00.000Z')
const NOW = new Date('2026-11-21T10:00:00.000Z')
const UPDATED = '2026-11-21T09:50:00.000Z'

const local = (date: string, kg: number, source: Weight['source'] = 'health', measuredAt = `${date}T05:30:00.000Z`) =>
  newRecord<Weight>({ date, kg, source, measuredAt }, T0)
const remote = (date: string, kg: number, measuredAt = `${date}T05:30:00.000Z`) => ({ date, kg, measuredAt })
const list = (...items: ReturnType<typeof remote>[]): WeightList => ({ from: '2026-09-01', updatedAt: UPDATED, items })

describe('parseWeightList', () => {
  const body = { ok: true, from: '2026-09-01', updatedAt: UPDATED, items: [remote('2026-10-12', 77.239)] }

  it('gültig → Liste', () => {
    expect(parseWeightList(body)).toEqual({ from: '2026-09-01', updatedAt: UPDATED, items: [remote('2026-10-12', 77.239)] })
  })

  it('nie geschrieben → from und updatedAt null', () => {
    expect(parseWeightList({ ok: true, from: null, updatedAt: null, items: [] })).toEqual({ from: null, updatedAt: null, items: [] })
  })

  it.each([
    ['ok fehlt', { ...body, ok: undefined }],
    ['kg zu klein', { ...body, items: [remote('2026-10-12', 19)] }],
    ['kg zu groß', { ...body, items: [remote('2026-10-12', 301)] }],
    ['Tag doppelt', { ...body, items: [remote('2026-10-12', 77), remote('2026-10-12', 78)] }],
    ['kein Kalendertag', { ...body, items: [remote('2026-02-30', 77)] }],
    ['kein Objekt', 'kaputt'],
  ])('%s → null', (_name, json) => {
    expect(parseWeightList(json)).toBeNull()
  })
})

describe('reconcileWeights', () => {
  const none = { created: [], updated: [], deleted: [] }

  it('updatedAt null → keine Änderung', () => {
    expect(reconcileWeights([local('2026-10-12', 77.2)], { from: null, updatedAt: null, items: [] }, NOW)).toEqual(none)
  })

  it('leere Liste → keine Änderung, auch wenn lokal Gewichte da sind', () => {
    expect(reconcileWeights([local('2026-10-12', 77.2)], list(), NOW)).toEqual(none)
  })

  it('neuer Tag → created mit source garmin', () => {
    const r = reconcileWeights([], list(remote('2026-10-14', 74.79, '2026-10-14T05:03:00.000Z')), NOW)
    expect(r.updated).toEqual([])
    expect(r.deleted).toEqual([])
    expect(r.created).toHaveLength(1)
    expect(r.created[0]).toMatchObject({
      date: '2026-10-14',
      kg: 74.79,
      source: 'garmin',
      measuredAt: '2026-10-14T05:03:00.000Z',
      createdAt: NOW.toISOString(),
      deletedAt: null,
    })
  })

  it('gleicher Tag, anderes kg → updated mit gleicher id', () => {
    const w = local('2026-10-12', 77.2, 'garmin')
    const r = reconcileWeights([w], list(remote('2026-10-12', 77.239)), NOW)
    expect(r.updated).toEqual([{ ...w, kg: 77.239, updatedAt: NOW.toISOString() }])
    expect(r.created).toEqual([])
    expect(r.deleted).toEqual([])
  })

  it('nur measuredAt anders → updated', () => {
    const w = local('2026-10-12', 77.239, 'garmin', '2026-10-12T09:33:00.000Z')
    const r = reconcileWeights([w], list(remote('2026-10-12', 77.239, '2026-10-12T05:53:00.000Z')), NOW)
    expect(r.updated).toEqual([{ ...w, measuredAt: '2026-10-12T05:53:00.000Z', updatedAt: NOW.toISOString() }])
  })

  it('source health, Werte gleich → updated auf garmin', () => {
    const w = local('2026-10-12', 77.239, 'health')
    expect(reconcileWeights([w], list(remote('2026-10-12', 77.239)), NOW).updated).toEqual([
      { ...w, source: 'garmin', updatedAt: NOW.toISOString() },
    ])
  })

  it('alles gleich → keine Änderung', () => {
    const w = local('2026-10-12', 77.239, 'garmin')
    expect(reconcileWeights([w], list(remote('2026-10-12', 77.239)), NOW)).toEqual(none)
  })

  it('lokaler Tag fehlt in der Liste → deleted, auch manuell und vor from', () => {
    const keep = local('2026-10-12', 77.239, 'garmin')
    const manual = local('2026-10-13', 75, 'manual')
    const before = local('2026-08-20', 73, 'health')
    const r = reconcileWeights([keep, manual, before], list(remote('2026-10-12', 77.239)), NOW)
    expect(r.deleted).toEqual([softDelete(manual, NOW), softDelete(before, NOW)])
    expect(r.created).toEqual([])
    expect(r.updated).toEqual([])
  })

  it('bereits gelöschte bleiben unberührt, auch wenn der Tag wiederkommt', () => {
    const gone = softDelete(local('2026-10-12', 77.2, 'health'), T0)
    const r = reconcileWeights([gone], list(remote('2026-10-12', 77.239)), NOW)
    expect(r.deleted).toEqual([])
    expect(r.updated).toEqual([])
    expect(r.created).toHaveLength(1)
    expect(r.created[0]?.id).not.toBe(gone.id)
  })

  it('zwei lokale Gewichte am selben Tag → eines abgeglichen, das andere deleted', () => {
    const a = local('2026-10-12', 77.239, 'garmin')
    const b = local('2026-10-12', 77.2, 'manual')
    const r = reconcileWeights([a, b], list(remote('2026-10-12', 77.239)), NOW)
    expect(r.created).toEqual([])
    expect(r.updated).toEqual([])
    expect(r.deleted).toEqual([softDelete(b, NOW)])
  })
})
