import { describe, expect, it } from 'vitest'
import { newRecord, softDelete } from '../db/records.ts'
import type { Weight } from '../db/types.ts'
import { toLocalDate } from './dates.ts'
import { mergeWeights, parseWeights, WEIGHT_HEADER } from './weightImport.ts'

const text = (...lines: string[]) => [WEIGHT_HEADER, ...lines].join('\n')

function samples(input: string) {
  const r = parseWeights(input)
  if (!r.ok) throw new Error(r.error)
  return r.samples
}

describe('parseWeights', () => {
  it('liest Zeitpunkt mit Zeitzone, Dezimalkomma und Einheit', () => {
    expect(samples(text('2026-10-22T07:12:00+02:00;74,8;kg'))).toEqual([
      { date: '2026-10-22', measuredAt: '2026-10-22T05:12:00.000Z', kg: 74.8 },
    ])
  })

  it('Punkt als Dezimalzeichen, ohne Einheit, Leerzeichen und Windows-Zeilenenden', () => {
    const list = samples(`  ${WEIGHT_HEADER}  \r\n\r\n 2026-10-21T06:58:31+02:00 ; 75.1 \r\n2026-10-20T07:00:00+0200;75;KG\r\n`)
    expect(list.map((s) => s.kg)).toEqual([75.1, 75])
    expect(list.map((s) => s.date)).toEqual(['2026-10-21', '2026-10-20'])
  })

  it('Tag laut Zeitzone im Text: 23:30 in New York bleibt der 21., auch wenn es in Deutschland schon der 22. ist', () => {
    expect(samples(text('2026-10-21T23:30:00-04:00;74,8;kg'))[0]?.date).toBe('2026-10-21')
    expect(samples(text('2026-10-22T00:30:00+09:00;74,8;kg'))[0]?.date).toBe('2026-10-22')
  })

  it('UTC („Z“) und ohne Zeitzone: Tag in der Ortszeit des Geräts', () => {
    const utc = samples(text('2026-10-21T23:30:00Z;74,8;kg'))[0]
    expect(utc?.date).toBe(toLocalDate(new Date('2026-10-21T23:30:00Z')))
    expect(utc?.measuredAt).toBe('2026-10-21T23:30:00.000Z')
    const local = samples(text('2026-10-22T07:12;74,8'))[0]
    expect(local?.date).toBe('2026-10-22')
    expect(local?.measuredAt).toBe(new Date(2026, 9, 22, 7, 12).toISOString())
  })

  it('nur Datum: Mitternacht Ortszeit', () => {
    expect(samples(text('2026-10-22;74,8'))[0]).toEqual({
      date: '2026-10-22',
      measuredAt: new Date(2026, 9, 22).toISOString(),
      kg: 74.8,
    })
  })

  it('BOM am Anfang stört nicht', () => {
    expect(samples(String.fromCharCode(0xfeff) + text('2026-10-22;74,8'))).toHaveLength(1)
  })

  it('Sekundenbruchteile werden akzeptiert', () => {
    expect(samples(text('2026-10-22T07:12:00.123+02:00;74,8;kg'))[0]?.measuredAt).toBe('2026-10-22T05:12:00.000Z')
  })

  it('Pfund werden in kg umgerechnet', () => {
    expect(samples(text('2026-10-22T07:12:00+02:00;165;lb'))[0]?.kg).toBeCloseTo(74.84, 2)
  })

  it('mehrere Messungen am selben Tag bleiben beim Lesen erhalten', () => {
    expect(samples(text('2026-10-22T07:12:00+02:00;74,8;kg', '2026-10-22T20:00:00+02:00;75,9;kg'))).toHaveLength(2)
  })

  describe('Fehler', () => {
    it('leere Zwischenablage', () => {
      expect(parseWeights('  \n ')).toEqual({ ok: false, error: 'Die Zwischenablage ist leer.' })
    })

    it('anderer Text (z. B. eine kopierte Adresse)', () => {
      expect(parseWeights('https://example.org')).toMatchObject({ ok: false, error: expect.stringContaining('Kurzbefehl') })
    })

    it('nur die Kopfzeile: keine Gewichte', () => {
      expect(parseWeights(WEIGHT_HEADER)).toMatchObject({ ok: false, error: expect.stringContaining('Keine Gewichte') })
    })

    it('eine kaputte Zeile: nichts wird übernommen, die Zeile wird genannt', () => {
      const r = parseWeights(text('2026-10-22T07:12:00+02:00;74,8;kg', '22.10.2026 07:12;74,8;kg'))
      expect(r).toEqual({ ok: false, error: 'Zeile 3 ist nicht lesbar: „22.10.2026 07:12;74,8;kg“' })
    })

    it.each([
      ['2026-02-30T07:00:00+01:00;74;kg', 'Datum gibt es nicht'],
      ['2026-10-22T07:12:00+02:00;;kg', 'Gewicht fehlt'],
      ['2026-10-22T07:12:00+02:00;74,8;st', 'unbekannte Einheit'],
      ['2026-10-22T07:12:00+02:00;1.074,8;kg', 'Tausenderpunkt'],
      ['2026-10-22T07:12:00+02:00;-74;kg', 'negativ'],
      ['2026-10-22T07:12:00+02:00;74,8;kg;x', 'zu viele Felder'],
      ['2026-10-22T25:00:00+02:00;74,8;kg', 'Stunde 25'],
    ])('%s (%s)', (line) => {
      expect(parseWeights(text(line))).toMatchObject({ ok: false, error: expect.stringContaining('Zeile 2') })
    })

    it('unplausibles Gewicht nennt die Grenzen', () => {
      expect(parseWeights(text('2026-10-22T07:12:00+02:00;7,48;kg'))).toEqual({
        ok: false,
        error: 'Zeile 2 ist nicht lesbar (Gewicht außerhalb 20–300 kg): „2026-10-22T07:12:00+02:00;7,48;kg“',
      })
    })
  })
})

describe('mergeWeights', () => {
  const now = new Date('2026-10-22T08:00:00Z')
  const stored = (date: string, kg: number, measuredAt: string, source: Weight['source'] = 'health') =>
    newRecord<Weight>({ date, kg, measuredAt, source }, new Date('2026-10-01T00:00:00Z'))

  it('neue Tage werden angelegt, mehrere Messungen am Tag: die früheste zählt', () => {
    const list = samples(
      text('2026-10-22T20:00:00+02:00;75,9;kg', '2026-10-22T07:12:00+02:00;74,8;kg', '2026-10-21T07:00:00+02:00;75,0;kg'),
    )
    const m = mergeWeights([], list, 'health', now)
    expect(m.read).toBe(3)
    expect(m.duplicates).toBe(1)
    expect(m.updated).toEqual([])
    expect(m.created.map((w) => [w.date, w.kg, w.source])).toEqual([
      ['2026-10-21', 75, 'health'],
      ['2026-10-22', 74.8, 'health'],
    ])
    expect(m.created[0]?.createdAt).toBe(now.toISOString())
  })

  it('bekannte Tage bleiben unverändert (wiederholter Import)', () => {
    const existing = [stored('2026-10-22', 74.8, '2026-10-22T05:12:00.000Z')]
    const m = mergeWeights(existing, samples(text('2026-10-22T07:12:00+02:00;74,8;kg')), 'health', now)
    expect(m).toEqual({ created: [], updated: [], read: 1, duplicates: 0 })
  })

  it('spätere Messung als die gespeicherte: bleibt unverändert', () => {
    const existing = [stored('2026-10-22', 74.8, '2026-10-22T05:12:00.000Z')]
    const m = mergeWeights(existing, samples(text('2026-10-22T19:00:00+02:00;75,9;kg')), 'health', now)
    expect(m.created).toEqual([])
    expect(m.updated).toEqual([])
  })

  it('frühere Messung als die gespeicherte (z. B. manuell später eingetragen): ersetzt sie', () => {
    const manual = stored('2026-10-22', 75, '2026-10-22T07:00:00.000Z', 'manual')
    const m = mergeWeights([manual], samples(text('2026-10-22T07:12:00+02:00;74,8;kg')), 'health', now)
    expect(m.created).toEqual([])
    expect(m.updated).toEqual([
      { ...manual, kg: 74.8, measuredAt: '2026-10-22T05:12:00.000Z', source: 'health', updatedAt: now.toISOString() },
    ])
  })

  it('gelöschter Tag kommt mit derselben Messung nicht zurück, mit einer anderen schon', () => {
    const gone = softDelete(stored('2026-10-22', 74.8, '2026-10-22T05:12:00.000Z'))
    const same = mergeWeights([gone], samples(text('2026-10-22T07:12:00+02:00;74,8;kg')), 'health', now)
    expect(same.created).toEqual([])
    const other = mergeWeights([gone], samples(text('2026-10-22T06:30:00+02:00;74,6;kg')), 'health', now)
    expect(other.created.map((w) => w.kg)).toEqual([74.6])
  })
})
