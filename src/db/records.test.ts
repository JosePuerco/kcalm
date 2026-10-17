import { describe, expect, it } from 'vitest'
import { isActive, newRecord, NUTRIENT_KEYS, softDelete, touch, unknownNutrients, upsertByKey } from './records.ts'
import type { Day, Setting } from './types.ts'

const t0 = new Date('2026-10-17T08:00:00.000Z')
const t1 = new Date('2026-10-18T09:30:00.000Z')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('unknownNutrients', () => {
  it('setzt alle zehn Nährwerte auf null, nicht auf 0', () => {
    const n = unknownNutrients()
    expect(Object.keys(n).sort()).toEqual([...NUTRIENT_KEYS].sort())
    for (const key of NUTRIENT_KEYS) expect(n[key]).toBeNull()
  })

  it('liefert jedes Mal ein neues Objekt', () => {
    const a = unknownNutrients()
    a.kcal = 100
    expect(unknownNutrients().kcal).toBeNull()
  })
})

describe('newRecord', () => {
  it('vergibt UUID und gleiche Zeitstempel, kein Löschmarker', () => {
    const day = newRecord<Day>({ date: '2026-10-17', complete: true }, t0)
    expect(day.id).toMatch(UUID)
    expect(day.createdAt).toBe('2026-10-17T08:00:00.000Z')
    expect(day.updatedAt).toBe(day.createdAt)
    expect(day.deletedAt).toBeNull()
    expect(day.date).toBe('2026-10-17')
  })

  it('vergibt jedes Mal eine andere id', () => {
    const a = newRecord<Day>({ date: '2026-10-17', complete: true })
    const b = newRecord<Day>({ date: '2026-10-17', complete: true })
    expect(a.id).not.toBe(b.id)
  })
})

describe('touch', () => {
  it('übernimmt Änderungen und setzt nur updatedAt neu', () => {
    const day = newRecord<Day>({ date: '2026-10-17', complete: false }, t0)
    const changed = touch(day, { complete: true }, t1)
    expect(changed.complete).toBe(true)
    expect(changed.id).toBe(day.id)
    expect(changed.createdAt).toBe(day.createdAt)
    expect(changed.updatedAt).toBe('2026-10-18T09:30:00.000Z')
  })

  it('verändert das Original nicht', () => {
    const day = newRecord<Day>({ date: '2026-10-17', complete: false }, t0)
    touch(day, { complete: true }, t1)
    expect(day.complete).toBe(false)
  })
})

describe('softDelete', () => {
  it('setzt Löschmarker und updatedAt, Daten bleiben erhalten', () => {
    const day = newRecord<Day>({ date: '2026-10-17', complete: true }, t0)
    const deleted = softDelete(day, t1)
    expect(deleted.deletedAt).toBe('2026-10-18T09:30:00.000Z')
    expect(deleted.updatedAt).toBe(deleted.deletedAt)
    expect(deleted.date).toBe('2026-10-17')
    expect(isActive(day)).toBe(true)
    expect(isActive(deleted)).toBe(false)
  })
})

describe('upsertByKey', () => {
  it('legt neu an, wenn es noch keinen Datensatz gibt', () => {
    const s = upsertByKey<Setting>(undefined, { key: 'theme', value: 'dark' }, t0)
    expect(s.id).toMatch(UUID)
    expect(s.value).toBe('dark')
  })

  it('aktualisiert einen vorhandenen Datensatz und behält id', () => {
    const old = newRecord<Setting>({ key: 'theme', value: 'dark' }, t0)
    const s = upsertByKey(old, { key: 'theme', value: 'light' }, t1)
    expect(s.id).toBe(old.id)
    expect(s.createdAt).toBe(old.createdAt)
    expect(s.value).toBe('light')
    expect(s.updatedAt).toBe('2026-10-18T09:30:00.000Z')
  })

  it('belebt einen gelöschten Datensatz wieder statt einen zweiten anzulegen', () => {
    const old = softDelete(newRecord<Day>({ date: '2026-10-17', complete: true }, t0), t0)
    const day = upsertByKey(old, { date: '2026-10-17', complete: true }, t1)
    expect(day.id).toBe(old.id)
    expect(day.deletedAt).toBeNull()
  })
})
