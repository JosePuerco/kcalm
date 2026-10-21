import { describe, expect, it } from 'vitest'
import { newRecord, unknownNutrients } from '../db/records.ts'
import type { Entry } from '../db/types.ts'
import { copiedEntries, copiedMessage } from './copyDay.ts'

function entry(slotId: string, kcal: number | null, createdAt: string, extra: Partial<Entry> = {}): Entry {
  return {
    ...newRecord<Entry>({
      date: '2026-10-20',
      slotId,
      kind: 'food',
      ref: 'product:skyr',
      nameSnapshot: 'Skyr',
      amount: 250,
      unit: 'g',
      portionLabel: '1 Becher',
      nutrients: { ...unknownNutrients(), kcal },
      waterMl: 0,
      mealGroupId: null,
      mealName: null,
    }),
    createdAt,
    ...extra,
  }
}

describe('copiedEntries', () => {
  const source = [
    entry('mittag', 500, '2026-10-20T12:00:00Z'),
    entry('frueh', 300, '2026-10-20T08:00:00Z'),
    entry('frueh', null, '2026-10-20T08:05:00Z', { kind: 'quick', ref: null, amount: null, unit: null, nameSnapshot: 'Kaffee' }),
    entry('abend', 999, '2026-10-20T19:00:00Z', { deletedAt: '2026-10-20T20:00:00Z' }),
  ]

  it('ganzer Tag: neues Datum, gleiche Slots und Snapshots, ohne gelöschte, in Anlagereihenfolge', () => {
    const r = copiedEntries(source, '2026-10-21')
    expect(r.map((e) => [e.slotId, e.nutrients.kcal])).toEqual([
      ['frueh', 300],
      ['frueh', null],
      ['mittag', 500],
    ])
    expect(r.every((e) => e.date === '2026-10-21')).toBe(true)
    expect(r[1]).toMatchObject({ kind: 'quick', ref: null, nameSnapshot: 'Kaffee' })
    expect(r[0]).not.toHaveProperty('id')
  })

  it('nur ein Slot', () => {
    expect(copiedEntries(source, '2026-10-21', { slotId: 'mittag' })).toHaveLength(1)
  })

  it('Nährwerte sind eine Kopie, kein geteiltes Objekt', () => {
    const r = copiedEntries(source, '2026-10-21')
    r[0]!.nutrients.kcal = 1
    expect(source[1]!.nutrients.kcal).toBe(300)
  })

  it('Mahlzeiten-Gruppen bekommen neue ids, Zusammengehörigkeit bleibt', () => {
    let n = 0
    const meal = [
      entry('frueh', 200, '2026-10-20T08:00:00Z', { mealGroupId: 'g1', mealName: 'Müsli' }),
      entry('frueh', 100, '2026-10-20T08:00:01Z', { mealGroupId: 'g1', mealName: 'Müsli' }),
      entry('mittag', 400, '2026-10-20T12:00:00Z', { mealGroupId: 'g2', mealName: 'Bowl' }),
    ]
    const r = copiedEntries(meal, '2026-10-21', { newId: () => `neu${++n}` })
    expect(r.map((e) => e.mealGroupId)).toEqual(['neu1', 'neu1', 'neu2'])
    expect(r[0]?.mealName).toBe('Müsli')
  })

  it('leerer Quelltag: nichts', () => {
    expect(copiedEntries([], '2026-10-21')).toEqual([])
  })

  it('copiedMessage', () => {
    expect(copiedMessage(1)).toBe('1 Eintrag übernommen')
    expect(copiedMessage(11)).toBe('11 Einträge übernommen')
  })
})
