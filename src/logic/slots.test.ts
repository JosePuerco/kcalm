import { describe, expect, it } from 'vitest'
import { DEFAULT_SLOTS, MAX_SLOTS, slotForTime, validateSlots } from './slots.ts'

const slots = DEFAULT_SLOTS.map((s, order) => ({ ...s, order }))
type Timed = { name: string; order: number; timeFrom: string | null; timeTo: string | null }
const nameAt = (time: string, list: Timed[] = slots) => slotForTime(list, time)?.name

describe('slotForTime', () => {
  it('Standard-Slots über den Tag', () => {
    expect(nameAt('07:15')).toBe('Frühstück')
    expect(nameAt('12:00')).toBe('Mittag')
    expect(nameAt('16:00')).toBe('Snacks')
    expect(nameAt('19:45')).toBe('Abend')
  })

  it('Start inklusive, Ende exklusive', () => {
    expect(nameAt('10:29')).toBe('Frühstück')
    expect(nameAt('10:30')).toBe('Mittag')
    expect(nameAt('04:00')).toBe('Frühstück')
  })

  it('Fenster über Mitternacht', () => {
    expect(nameAt('23:59')).toBe('Abend')
    expect(nameAt('00:00')).toBe('Abend')
    expect(nameAt('03:59')).toBe('Abend')
  })

  it('Überlappung: früherer Slot gewinnt', () => {
    const list = [
      { name: 'Mittag', order: 0, timeFrom: '11:00', timeTo: '14:00' },
      { name: 'Snack', order: 1, timeFrom: '13:00', timeTo: '16:00' },
    ]
    expect(nameAt('13:30', list)).toBe('Mittag')
  })

  it('Reihenfolge zählt, nicht die Position in der Liste', () => {
    const list = [
      { name: 'Snack', order: 1, timeFrom: '13:00', timeTo: '16:00' },
      { name: 'Mittag', order: 0, timeFrom: '11:00', timeTo: '14:00' },
    ]
    expect(nameAt('13:30', list)).toBe('Mittag')
  })

  it('Lücke: der Slot, dessen Start zuletzt vorbei ist', () => {
    const list = [
      { name: 'Frühstück', order: 0, timeFrom: '06:00', timeTo: '09:00' },
      { name: 'Abend', order: 1, timeFrom: '18:00', timeTo: '21:00' },
    ]
    expect(nameAt('10:00', list)).toBe('Frühstück')
    expect(nameAt('22:00', list)).toBe('Abend')
    expect(nameAt('02:00', list)).toBe('Abend') // über Mitternacht zurück
  })

  it('ohne Uhrzeiten: erster Slot', () => {
    const list = [
      { name: 'B', order: 1, timeFrom: null, timeTo: null },
      { name: 'A', order: 0, timeFrom: null, timeTo: null },
    ]
    expect(nameAt('12:00', list)).toBe('A')
  })

  it('keine Slots: null', () => {
    expect(slotForTime([], '12:00')).toBeNull()
  })

  it('lehnt ungültige Uhrzeit ab', () => {
    expect(() => slotForTime(slots, '24:00')).toThrow(RangeError)
    expect(() => slotForTime(slots, '7:15')).toThrow(RangeError)
  })
})

describe('validateSlots', () => {
  it('Standard ist gültig, leere Uhrzeit wird null', () => {
    const r = validateSlots([...DEFAULT_SLOTS, { name: ' Spät ', timeFrom: '', timeTo: '' }])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.slots[4]).toEqual({ name: 'Spät', timeFrom: null, timeTo: null })
      expect(r.slots[0]).toEqual({ name: 'Frühstück', timeFrom: '04:00', timeTo: '10:30' })
    }
  })

  it('behält vorhandene ids', () => {
    const r = validateSlots([{ id: 'a', name: 'Mittag', timeFrom: '', timeTo: '' }])
    expect(r.ok && r.slots[0]?.id).toBe('a')
  })

  it('Name Pflicht, eindeutig ohne Groß/klein', () => {
    const r = validateSlots([
      { name: '  ', timeFrom: '', timeTo: '' },
      { name: 'Abend', timeFrom: '', timeTo: '' },
      { name: 'abend', timeFrom: '', timeTo: '' },
    ])
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors[0]?.name).toBe('Bitte benennen')
      expect(r.errors[1]).toBeUndefined()
      expect(r.errors[2]?.name).toBe('Name schon vergeben')
    }
  })

  it('Uhrzeit ganz oder gar nicht, gültig, nicht gleich', () => {
    const r = validateSlots([
      { name: 'A', timeFrom: '08:00', timeTo: '' },
      { name: 'B', timeFrom: '8:00', timeTo: '09:00' },
      { name: 'C', timeFrom: '09:00', timeTo: '09:00' },
    ])
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors[0]?.time).toMatch(/beide/)
      expect(r.errors[1]?.time).toMatch(/HH:MM/)
      expect(r.errors[2]?.time).toMatch(/unterscheiden/)
    }
  })

  it('mindestens einer, höchstens MAX_SLOTS', () => {
    expect(validateSlots([])).toMatchObject({ ok: false, general: 'Mindestens ein Slot' })
    const many = Array.from({ length: MAX_SLOTS + 1 }, (_, i) => ({ name: `S${i}`, timeFrom: '', timeTo: '' }))
    expect(validateSlots(many).ok).toBe(false)
  })
})
