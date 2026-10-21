import { describe, expect, it } from 'vitest'
import { newRecord, unknownNutrients } from '../db/records.ts'
import type { Entry, Nutrients, Slot } from '../db/types.ts'
import {
  addMonths,
  dayLabel,
  dayOverview,
  entryCount,
  formatSum,
  kcalByDate,
  monthGrid,
  monthLabel,
  slotsForDay,
  weekBarScale,
} from './diary.ts'
import { weekStatus } from './goals.ts'

const slot = (name: string, order: number, archived = false): Slot => ({
  ...newRecord<Slot>({ name, order, timeFrom: null, timeTo: null, archived }),
  id: name,
})

function entry(slotId: string, n: Partial<Nutrients>, date = '2026-10-22', createdAt = '2026-10-22T08:00:00.000Z'): Entry {
  return {
    ...newRecord<Entry>({
      date,
      slotId,
      kind: 'quick',
      ref: null,
      nameSnapshot: 'Test',
      amount: null,
      unit: null,
      portionLabel: null,
      nutrients: { ...unknownNutrients(), ...n },
      waterMl: 0,
      mealGroupId: null,
      mealName: null,
    }),
    createdAt,
  }
}

describe('Beschriftungen', () => {
  it('dayLabel: Wochentag, Datum, relativ', () => {
    expect(dayLabel('2026-10-22', '2026-10-22')).toEqual({ date: 'Do 22.10.', relative: 'Heute' })
    expect(dayLabel('2026-10-21', '2026-10-22').relative).toBe('Gestern')
    expect(dayLabel('2026-10-23', '2026-10-22').relative).toBe('Morgen')
    expect(dayLabel('2026-10-19', '2026-10-22')).toEqual({ date: 'Mo 19.10.', relative: null })
  })

  it('dayLabel: anderes Jahr mit Jahreszahl', () => {
    expect(dayLabel('2025-12-31', '2026-01-02').date).toBe('Mi 31.12.2025')
  })

  it('monthLabel, addMonths über Jahresgrenzen', () => {
    expect(monthLabel('2026-10')).toBe('Oktober 2026')
    expect(monthLabel('2026-03')).toBe('März 2026')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2027-01', -1)).toBe('2026-12')
    expect(addMonths('2026-10', -10)).toBe('2025-12')
  })

  it('entryCount', () => {
    expect(entryCount(1)).toBe('1 Eintrag')
    expect(entryCount(11)).toBe('11 Einträge')
  })

  it('formatSum mit „mind.“', () => {
    expect(formatSum({ value: 2850.4, atLeast: false })).toBe('2.850')
    expect(formatSum({ value: 12.34, atLeast: true }, 1)).toBe('mind. 12,3')
    expect(formatSum({ value: null, atLeast: false })).toBe('–')
  })
})

describe('monthGrid', () => {
  it('Oktober 2026 beginnt am Donnerstag: 3 leere Felder, volle Wochen', () => {
    const grid = monthGrid('2026-10')
    expect(grid.slice(0, 4)).toEqual([null, null, null, '2026-10-01'])
    expect(grid.filter(Boolean)).toHaveLength(31)
    expect(grid.length % 7).toBe(0)
    expect(grid.at(-1)).toBeNull() // 31.10. ist Samstag
  })

  it('Monat, der am Montag beginnt, und Februar im Schaltjahr', () => {
    expect(monthGrid('2027-02')[0]).toBe('2027-02-01')
    expect(monthGrid('2028-02').filter(Boolean)).toHaveLength(29)
  })
})

describe('slotsForDay', () => {
  const slots = [slot('Abend', 3), slot('Frühstück', 0), slot('Mittag', 1), slot('Alt', 2, true)]

  it('aktive Slots in Reihenfolge, auch leere', () => {
    const r = slotsForDay(slots, [])
    expect(r.map((s) => s.slot.name)).toEqual(['Frühstück', 'Mittag', 'Abend'])
    expect(r[0]?.kcal).toEqual({ value: 0, atLeast: false })
  })

  it('archivierter Slot nur mit Einträgen, hinten', () => {
    const r = slotsForDay(slots, [entry('Alt', { kcal: 100 })])
    expect(r.map((s) => s.slot.name)).toEqual(['Frühstück', 'Mittag', 'Abend', 'Alt'])
  })

  it('Einträge nach Anlegezeit, Summe mit „mind.“', () => {
    const r = slotsForDay(slots, [
      entry('Mittag', { kcal: 300 }, undefined, '2026-10-22T12:05:00.000Z'),
      entry('Mittag', { kcal: null }, undefined, '2026-10-22T12:01:00.000Z'),
    ])
    const mittag = r.find((s) => s.slot.name === 'Mittag')
    expect(mittag?.entries.map((e) => e.nutrients.kcal)).toEqual([null, 300])
    expect(mittag?.kcal).toEqual({ value: 300, atLeast: true })
  })

  it('unbekannter Slot → erster Slot, nichts verschwindet', () => {
    const r = slotsForDay(slots, [entry('weg', { kcal: 50 })])
    expect(r[0]?.entries).toHaveLength(1)
  })

  it('gelöschte Slots erscheinen nicht', () => {
    const deleted = { ...slot('X', 5), deletedAt: '2026-10-01T00:00:00.000Z' }
    expect(slotsForDay([...slots, deleted], []).map((s) => s.slot.name)).not.toContain('X')
  })
})

describe('kcalByDate', () => {
  it('summiert bekannte kcal je Tag, ohne gelöschte', () => {
    const r = kcalByDate([
      entry('a', { kcal: 300 }, '2026-10-21'),
      entry('a', { kcal: 200 }, '2026-10-21'),
      entry('a', { kcal: null }, '2026-10-22'),
      { ...entry('a', { kcal: 999 }, '2026-10-22'), deletedAt: '2026-10-22T09:00:00.000Z' },
    ])
    expect(r).toEqual({ '2026-10-21': 500, '2026-10-22': 0 })
  })
})

describe('dayOverview', () => {
  const version = {
    weeklyKcal: 19600,
    protein: { mode: 'gPerKg' as const, value: 1.8 },
    fat: { mode: 'percent' as const, value: 25 },
    carbs: { mode: 'rest' as const, value: null },
    fiberG: 30,
    manualWeightKg: 74,
  }
  const goal = { version, weekBudget: 19600, countFrom: null }
  const week = { '2026-10-19': 2950, '2026-10-20': 3100, '2026-10-21': 2850 }

  it('Ring: dynamisches Ziel, übrig, Anteil', () => {
    const today = [entry('a', { kcal: 1000, protein: 50 })]
    const o = dayOverview('2026-10-22', '2026-10-22', today, { ...week, '2026-10-22': 1000 }, goal)
    expect(o.target).toBe(2675)
    expect(o.remaining).toBe(1675)
    expect(o.over).toBe(false)
    expect(o.progress).toBeCloseTo(1000 / 2675, 10)
    expect(o.week?.consumed).toBe(9900)
  })

  it('drüber: orange, Anteil voll', () => {
    const o = dayOverview('2026-10-22', '2026-10-22', [entry('a', { kcal: 3000 })], week, goal)
    expect(o.remaining).toBe(-325)
    expect(o.over).toBe(true)
    expect(o.progress).toBe(1)
  })

  it('leerer Tag: Ring leer, Zahl = Ziel (Leer.dc.html)', () => {
    const o = dayOverview('2026-10-22', '2026-10-22', [], week, goal)
    expect(o.remaining).toBe(2675)
    expect(o.progress).toBe(0)
    expect(o.macros.map((m) => m.eaten.value)).toEqual([0, 0, 0, 0])
  })

  it('Budget schon vorher überschritten: Ziel ≤ 0 zählt als drüber', () => {
    const o = dayOverview('2026-10-25', '2026-10-25', [], { '2026-10-19': 20000 }, goal)
    expect(o.target).toBe(-400)
    expect(o.over).toBe(true)
    expect(o.progress).toBe(1)
  })

  it('Makros in der Reihenfolge Eiweiß, KH, Fett, Ballaststoffe mit Zielen', () => {
    const o = dayOverview('2026-10-22', '2026-10-22', [entry('a', { protein: 40, fiber: null })], week, goal)
    expect(o.macros.map((m) => m.label)).toEqual(['Eiweiß', 'Kohlenhydrate', 'Fett', 'Ballaststoffe'])
    expect(o.macros[0]?.goal).toBeCloseTo(133.2, 10)
    expect(o.macros[1]?.goal).toBeCloseTo(391.8, 10)
    expect(o.macros[3]?.goal).toBe(30)
    expect(o.macros[3]?.eaten).toEqual({ value: null, atLeast: false })
  })

  it('Profilstart mitten in der Woche: Vortage zählen nicht, festes Ziel aus der Version', () => {
    // Start Mi 21.10.: Budget Mi–So = 19.600 × 5 ÷ 7 = 14.000; Mo/Di ohne Profil
    const start = { version, weekBudget: 14000, countFrom: '2026-10-21' }
    const o = dayOverview('2026-10-21', '2026-10-21', [], week, start)
    expect(o.target).toBe(2800)
    expect(o.week?.consumed).toBe(2850)
    expect(o.week?.fixedTarget).toBe(2800)
    expect(o.week?.days[0]?.kcal).toBe(2950) // Balken zeigt den Tag trotzdem
  })

  it('ohne Profil: kein Ziel, keine Woche', () => {
    const o = dayOverview('2026-10-22', '2026-10-22', [entry('a', { kcal: 500 })], {}, null)
    expect(o).toMatchObject({ target: null, remaining: null, over: false, progress: 0, week: null })
    expect(o.eaten.value).toBe(500)
  })
})

describe('weekBarScale', () => {
  it('festes Ziel bei 7/8 der Höhe, höhere Tage strecken', () => {
    expect(weekBarScale(weekStatus('2026-10-22', '2026-10-22', {}, 19600))).toBe(3200)
    expect(weekBarScale(weekStatus('2026-10-22', '2026-10-22', { '2026-10-20': 4000 }, 19600))).toBe(4000)
  })
})
