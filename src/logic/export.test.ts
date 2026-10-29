import { describe, expect, it } from 'vitest'
import { newRecord } from '../db/records.ts'
import type { Entry, LocalDate, Nutrients, ProfileAssignment, ProfileVersion, Slot, Weight } from '../db/types.ts'
import {
  CLAUDE_TEMPLATE,
  columnsFor,
  exportFile,
  exportFileName,
  exportKeys,
  exportRange,
  exportTable,
  isTemplate,
  isoWeekLabel,
  lastMonthRange,
  rangeDayCount,
  rangeText,
  roundTo,
  shareLabel,
  toCsv,
  toJson,
  weeks4Range,
  type ExportColumn,
  type ExportInput,
  type ExportSettings,
} from './export.ts'

// So 25.10.2026
const today = '2026-10-25'
const september = { from: '2026-09-01', to: '2026-09-30' }

function slot(id: string, name: string, order: number, extra: Partial<Slot> = {}): Slot {
  return { ...newRecord<Slot>({ name, order, timeFrom: null, timeTo: null, archived: false }), id, ...extra }
}

const slots = [slot('abend', 'Abend', 3), slot('fr', 'Frühstück', 0), slot('mi', 'Mittag', 1)]

const full: Nutrients = { kcal: 0, fat: 0, satFat: 0, carbs: 0, sugar: 0, fiber: 0, protein: 0, salt: 0 }

let clock = 0
function entry(date: LocalDate, slotId: string, name: string, nutrients: Partial<Nutrients>, extra: Partial<Entry> = {}): Entry {
  clock++
  return {
    ...newRecord<Entry>({
      date,
      slotId,
      kind: 'food',
      ref: null,
      nameSnapshot: name,
      amount: 100,
      unit: 'g',
      portionLabel: null,
      nutrients: { ...full, ...nutrients },
      mealGroupId: null,
      mealName: null,
      cost: null,
    }),
    createdAt: `2026-09-01T08:00:${String(clock).padStart(4, '0')}.000Z`,
    ...extra,
  }
}

function version(id: string, weeklyKcal: number): ProfileVersion {
  return {
    ...newRecord<ProfileVersion>({
      profileId: 'p',
      weeklyKcal,
      protein: { mode: 'g', value: 140 },
      fat: { mode: 'g', value: 80 },
      carbs: { mode: 'rest', value: null },
      fiberG: 30,
      manualWeightKg: null,
    }),
    id,
  }
}

function assign(validFrom: LocalDate, versionId: string, weekBudgetOverride: number | null = null): ProfileAssignment {
  return newRecord<ProfileAssignment>({ validFrom, profileVersionId: versionId, weekBudgetOverride })
}

function weight(date: LocalDate, kg: number, time = '07:00'): Pick<Weight, 'date' | 'kg' | 'measuredAt'> {
  return { date, kg, measuredAt: `${date}T${time}:00.000+02:00` }
}

function input(extra: Partial<ExportInput> = {}): ExportInput {
  return {
    range: september,
    entries: [],
    completeDates: new Set(),
    slots,
    assignments: [assign('2026-01-05', 'v1')],
    versions: [version('v1', 19600)],
    weights: [],
    prices: () => null,
    ...extra,
  }
}

/** Gewicht an, Kosten aus (Stand vor Phase 13) bzw. beides aus */
const WEIGHT = { weight: true, cost: false }
const NONE = { weight: false, cost: false }

const cols = (...keys: ExportColumn[]) => new Set<ExportColumn>(keys)
const nutrientCols = cols('date', 'complete', 'kcal', 'protein', 'fiber', 'salt')

describe('Zeitraum', () => {
  it('Letzter Monat = voriger Kalendermonat', () => {
    expect(lastMonthRange(today)).toEqual(september)
    expect(lastMonthRange('2026-03-01')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(lastMonthRange('2028-03-15')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('Letzter Monat über den Jahreswechsel', () => {
    expect(lastMonthRange('2027-01-10')).toEqual({ from: '2026-12-01', to: '2026-12-31' })
  })

  it('4 Wochen = 28 Tage inklusive heute', () => {
    const r = weeks4Range('2026-10-16')
    expect(r).toEqual({ from: '2026-09-19', to: '2026-10-16' })
    expect(rangeDayCount(r)).toBe(28)
  })

  it('Alles = erster Tag mit Daten bis heute; ohne Daten nichts', () => {
    expect(exportRange('all', today, { firstDate: '2026-09-01' })).toEqual({ from: '2026-09-01', to: today })
    expect(exportRange('all', today, { firstDate: null })).toBeNull()
    expect(exportRange('all', today, { firstDate: '2026-11-01' })).toBeNull()
  })

  it('Frei: Ende höchstens heute, Start nach Ende oder leer → nichts', () => {
    expect(exportRange('free', today, { firstDate: null, from: '2026-10-01', to: '2026-12-31' })).toEqual({
      from: '2026-10-01',
      to: today,
    })
    expect(exportRange('free', today, { firstDate: null, from: '2026-10-10', to: '2026-10-09' })).toBeNull()
    expect(exportRange('free', today, { firstDate: null, from: '2026-10-26', to: '2026-10-30' })).toBeNull()
    expect(exportRange('free', today, { firstDate: null, from: '', to: '2026-10-09' })).toBeNull()
    expect(exportRange('free', today, { firstDate: null, from: today, to: today })).toEqual({ from: today, to: today })
  })

  it('Text unter den Chips', () => {
    expect(rangeText(september)).toBe('01.09.2026 – 30.09.2026 · 30 Tage')
    expect(rangeText({ from: today, to: today })).toBe('25.10.2026 – 25.10.2026 · 1 Tag')
  })

  it('ISO-Kalenderwoche mit Jahr des Donnerstags', () => {
    expect(isoWeekLabel('2026-09-01')).toBe('2026-W36')
    expect(isoWeekLabel('2027-01-01')).toBe('2026-W53')
    expect(isoWeekLabel('2027-01-04')).toBe('2027-W01')
  })
})

describe('Spalten', () => {
  it('je Ebene nur passende Spalten', () => {
    expect(columnsFor('entries', WEIGHT)).toEqual([
      'date', 'complete', 'slot', 'name', 'amount',
      'kcal', 'protein', 'carbs', 'fat', 'satFat', 'sugar', 'fiber', 'salt',
    ])
    expect(columnsFor('slots', WEIGHT)).not.toContain('name')
    expect(columnsFor('slots', WEIGHT)).toContain('slot')
    expect(columnsFor('days', WEIGHT)).toEqual([
      'date', 'complete', 'kcal', 'protein', 'carbs', 'fat', 'satFat', 'sugar', 'fiber', 'salt', 'budget', 'weight',
    ])
  })

  it('ohne Verbrauchsschätzung kein Gewicht', () => {
    expect(columnsFor('days', NONE)).not.toContain('weight')
    expect(columnsFor('weeks', NONE)).toContain('budget')
  })

  it('Schlüssel in fester Reihenfolge, Wochen mit Zeitraum und Anzahl', () => {
    const all = new Set(columnsFor('weeks', WEIGHT))
    expect(exportKeys('weeks', all)).toEqual([
      'week', 'from', 'to', 'days', 'complete_days',
      'kcal', 'protein_g', 'carbs_g', 'fat_g', 'satfat_g', 'sugar_g', 'fiber_g', 'salt_g',
      'budget_kcal', 'weight_kg', 'partial',
    ])
    expect(exportKeys('entries', cols('date', 'amount', 'kcal'))).toEqual(['date', 'amount', 'unit', 'kcal'])
  })

  it('nicht passende gewählte Spalten werden ignoriert', () => {
    expect(exportKeys('days', cols('date', 'slot', 'name', 'kcal'))).toEqual(['date', 'kcal', 'partial'])
    expect(exportKeys('days', cols('date', 'weight'), NONE)).toEqual(['date'])
  })

  it('ohne Nährwerte kein partial', () => {
    expect(exportKeys('days', cols('date', 'budget'))).toEqual(['date', 'budget_kcal'])
  })
})

describe('Spalte Kosten', () => {
  const COST = { weight: true, cost: true }
  // 1 € je 100 g; „ohne“ hat keinen Preis
  const prices = (ref: string) => (ref === 'product:hafer' ? 0.01 : null)
  const costEntries = [
    entry('2026-09-01', 'fr', 'Hafer', { kcal: 372 }, { ref: 'product:hafer', amount: 60 }),
    entry('2026-09-01', 'fr', 'Ohne', { kcal: 100 }, { ref: 'product:ohne', amount: 50 }),
    entry('2026-09-01', 'abend', 'Kantine', { kcal: 850 }, { kind: 'quick', ref: null, amount: null, unit: null, cost: 7.456 }),
    entry('2026-09-02', 'fr', 'Hafer', { kcal: 372 }, { ref: 'product:hafer', amount: 100 }),
  ]

  it('nur bei aktiver Kostenauswertung, auf allen Ebenen, nach den Nährwerten', () => {
    expect(columnsFor('entries', WEIGHT)).not.toContain('cost')
    for (const level of ['entries', 'slots', 'days', 'weeks'] as const) expect(columnsFor(level, COST)).toContain('cost')
    expect(exportKeys('days', cols('date', 'kcal', 'cost', 'budget'), COST)).toEqual([
      'date', 'kcal', 'cost_eur', 'budget_kcal', 'partial',
    ])
    expect(exportKeys('days', cols('date', 'cost'), WEIGHT)).toEqual(['date'])
  })

  it('ohne Nährwerte trotzdem partial, weil Kosten fehlen können', () => {
    expect(exportKeys('slots', cols('slot', 'cost'), COST)).toEqual(['slot', 'cost_eur', 'partial'])
    expect(exportKeys('entries', cols('name', 'cost'), COST)).toEqual(['name', 'cost_eur'])
  })

  it('Einträge: aktueller Preis × Menge bzw. Preis des Schnelleintrags, 2 Stellen, unbekannt = null', () => {
    const t = exportTable('entries', cols('name', 'cost'), input({ entries: costEntries, prices }), COST)
    expect(t.rows).toEqual([
      ['Hafer', 0.6],
      ['Ohne', null],
      ['Kantine', 7.46],
      ['Hafer', 1],
    ])
  })

  it('Tage: Summe, unbekannte Teile in partial, Tag ohne Einträge null', () => {
    const t = exportTable('days', cols('date', 'cost'), input({ entries: costEntries, prices }), COST)
    expect(t.rows.slice(0, 3)).toEqual([
      ['2026-09-01', 8.06, ['cost_eur']],
      ['2026-09-02', 1, []],
      ['2026-09-03', null, []],
    ])
  })

  it('Wochen und Slots summieren ebenso', () => {
    const weeks = exportTable('weeks', cols('cost'), input({ entries: costEntries, prices }), COST)
    expect(weeks.rows[0]).toEqual([9.06, ['cost_eur']])
    const slotsTable = exportTable('slots', cols('slot', 'cost'), input({ entries: costEntries, prices }), COST)
    expect(slotsTable.rows).toEqual([
      ['Frühstück', 0.6, ['cost_eur']],
      ['Abend', 7.46, []],
      ['Frühstück', 1, []],
    ])
  })

  it('Kostenauswertung aus: keine Spalte, auch wenn sie gewählt ist', () => {
    const t = exportTable('days', cols('date', 'cost'), input({ entries: costEntries, prices }), WEIGHT)
    expect(t.keys).toEqual(['date'])
  })

  it('Vorlage bleibt Vorlage, Kosten gehören nicht dazu', () => {
    const tpl: ExportSettings = { ...CLAUDE_TEMPLATE, columns: new Set(CLAUDE_TEMPLATE.columns) }
    expect(isTemplate(tpl, COST)).toBe(true)
    expect(isTemplate({ ...tpl, columns: new Set([...tpl.columns, 'cost']) }, COST)).toBe(false)
  })
})

describe('Ebene Einträge', () => {
  it('nach Tag, Slot-Reihenfolge und Anlegezeit; gerundet; unbekannt = null', () => {
    const t = exportTable(
      'entries',
      cols('date', 'complete', 'slot', 'name', 'amount', 'kcal', 'protein', 'fiber', 'salt'),
      input({
        entries: [
          entry('2026-09-02', 'abend', 'Pizza', { kcal: 850, fiber: null }, { kind: 'quick', amount: null, unit: null }),
          entry('2026-09-01', 'abend', 'Brot', { kcal: 250 }),
          entry('2026-09-01', 'fr', 'Haferflocken', { kcal: 223.2, protein: 8.06, fiber: 6, salt: 0.006 }, { amount: 60 }),
          entry('2026-09-01', 'fr', 'Milch, 3,5 %', { kcal: 160, fiber: null }, { amount: 250, unit: 'ml' }),
        ],
        completeDates: new Set(['2026-09-01']),
      }),
    )
    expect(t.keys).toEqual(['date', 'complete', 'slot', 'name', 'amount', 'unit', 'kcal', 'protein_g', 'fiber_g', 'salt_g'])
    expect(t.rows).toEqual([
      ['2026-09-01', true, 'Frühstück', 'Haferflocken', 60, 'g', 223, 8.1, 6, 0.01],
      ['2026-09-01', true, 'Frühstück', 'Milch, 3,5 %', 250, 'ml', 160, 0, null, 0],
      ['2026-09-01', true, 'Abend', 'Brot', 100, 'g', 250, 0, 0, 0],
      ['2026-09-02', false, 'Abend', 'Pizza', null, null, 850, 0, null, 0],
    ])
  })

  it('außerhalb des Zeitraums und gelöschte zählen nicht', () => {
    const t = exportTable(
      'entries',
      cols('name'),
      input({
        entries: [
          entry('2026-08-31', 'fr', 'Vorher', {}),
          entry('2026-10-01', 'fr', 'Nachher', {}),
          entry('2026-09-10', 'fr', 'Gelöscht', {}, { deletedAt: '2026-09-11T00:00:00.000Z' }),
          entry('2026-09-30', 'fr', 'Drin', {}),
        ],
      }),
    )
    expect(t.rows).toEqual([['Drin']])
  })

  it('Eintrag in unbekanntem Slot landet im ersten (wie im Tagebuch)', () => {
    const t = exportTable('entries', cols('slot', 'name'), input({ entries: [entry('2026-09-01', 'weg', 'X', {})] }))
    expect(t.rows).toEqual([['Frühstück', 'X']])
  })

  it('archivierter Slot mit Einträgen bleibt mit Namen', () => {
    const t = exportTable(
      'entries',
      cols('slot'),
      input({ slots: [...slots, slot('alt', 'Spät', 9, { archived: true })], entries: [entry('2026-09-01', 'alt', 'X', {})] }),
    )
    expect(t.rows).toEqual([['Spät']])
  })
})

describe('Ebene Slots', () => {
  it('Summen je Slot, partial bei unbekannten Teilen', () => {
    const t = exportTable(
      'slots',
      cols('date', 'complete', 'slot', 'kcal', 'fiber'),
      input({
        entries: [
          entry('2026-09-01', 'fr', 'A', { kcal: 223.2, fiber: 6 }),
          entry('2026-09-01', 'fr', 'B', { kcal: 160, fiber: null }),
          entry('2026-09-01', 'abend', 'C', { kcal: null, fiber: null }),
        ],
      }),
    )
    expect(t.keys).toEqual(['date', 'complete', 'slot', 'kcal', 'fiber_g', 'partial'])
    expect(t.rows).toEqual([
      ['2026-09-01', false, 'Frühstück', 383, 6, ['fiber_g']],
      ['2026-09-01', false, 'Abend', null, null, []],
    ])
  })

  it('Slots ohne Einträge fehlen', () => {
    const t = exportTable('slots', cols('slot'), input({ entries: [entry('2026-09-01', 'mi', 'A', {})] }))
    expect(t.rows).toEqual([['Mittag']])
  })
})

describe('Ebene Tage', () => {
  it('jeder Tag des Zeitraums; ohne Einträge Nährwerte null, nicht 0', () => {
    const t = exportTable(
      'days',
      cols('date', 'complete', 'kcal', 'fiber', 'budget', 'weight'),
      input({
        range: { from: '2026-09-01', to: '2026-09-03' },
        entries: [
          entry('2026-09-01', 'fr', 'A', { kcal: 2000, fiber: 20 }),
          entry('2026-09-01', 'abend', 'B', { kcal: 911.4, fiber: null }),
          entry('2026-09-03', 'fr', 'C', { kcal: 0 }),
        ],
        completeDates: new Set(['2026-09-01', '2026-09-02']),
        weights: [weight('2026-09-02', 74.04)],
      }),
    )
    expect(t.keys).toEqual(['date', 'complete', 'kcal', 'fiber_g', 'budget_kcal', 'weight_kg', 'partial'])
    expect(t.rows).toEqual([
      ['2026-09-01', true, 2911, 20, 2800, null, ['fiber_g']],
      // markiert, aber ohne Einträge → nicht vollständig (wie in der Statistik)
      ['2026-09-02', false, null, null, 2800, 74, []],
      ['2026-09-03', false, 0, 0, 2800, null, []],
    ])
  })

  it('Budget = festes Tagesziel der damals gültigen Version, vor dem ersten Profil null', () => {
    const t = exportTable(
      'days',
      cols('date', 'budget'),
      input({
        range: { from: '2026-09-06', to: '2026-09-08' },
        assignments: [assign('2026-09-07', 'v1'), assign('2026-09-08', 'v2')],
        versions: [version('v1', 19600), version('v2', 15400)],
      }),
    )
    expect(t.rows).toEqual([
      ['2026-09-06', null],
      ['2026-09-07', 2800],
      ['2026-09-08', 2200],
    ])
  })

  it('mehrere Wiegungen am Tag: die erste zählt', () => {
    const t = exportTable(
      'days',
      cols('weight'),
      input({
        range: { from: '2026-09-01', to: '2026-09-01' },
        weights: [weight('2026-09-01', 75.3, '20:00'), weight('2026-09-01', 74.2, '06:30')],
      }),
    )
    expect(t.rows).toEqual([[74.2]])
  })
})

describe('Ebene Wochen', () => {
  it('Mo–So, angeschnitten auf den Zeitraum; Summen, vollständige Tage, anteiliges Budget, Ø Gewicht', () => {
    const t = exportTable(
      'weeks',
      cols('date', 'complete', 'kcal', 'budget', 'weight'),
      input({
        entries: [
          entry('2026-09-01', 'fr', 'A', { kcal: 2500 }),
          entry('2026-09-02', 'fr', 'B', { kcal: 3000.4 }),
          entry('2026-09-30', 'fr', 'C', { kcal: null }),
        ],
        completeDates: new Set(['2026-09-01', '2026-09-05', '2026-09-30']),
        weights: [weight('2026-09-01', 74.2), weight('2026-09-03', 74.0), weight('2026-09-10', 73.5)],
      }),
    )
    expect(t.keys).toEqual(['week', 'from', 'to', 'days', 'complete_days', 'kcal', 'budget_kcal', 'weight_kg', 'partial'])
    expect(t.rows).toHaveLength(5)
    expect(t.rows[0]).toEqual(['2026-W36', '2026-09-01', '2026-09-06', 6, 1, 5500, 16800, 74.1, []])
    expect(t.rows[1]).toEqual(['2026-W37', '2026-09-07', '2026-09-13', 7, 0, null, 19600, 73.5, []])
    expect(t.rows[4]).toEqual(['2026-W40', '2026-09-28', '2026-09-30', 3, 1, null, 8400, null, []])
  })

  it('Woche mit Wechsel „ab heute“ ergibt das umgerechnete Wochenbudget', () => {
    const t = exportTable(
      'weeks',
      cols('budget'),
      input({
        range: { from: '2026-09-07', to: '2026-09-13' },
        assignments: [assign('2026-01-05', 'v1'), assign('2026-09-10', 'v2', 17700)],
        versions: [version('v1', 19600), version('v2', 15400)],
      }),
    )
    expect(t.rows).toEqual([[17700]])
  })

  it('erstes Profil mitten in der Woche: Budget nur für Tage mit Profil, sonst null', () => {
    const t = exportTable(
      'weeks',
      cols('budget'),
      input({ range: { from: '2026-08-31', to: '2026-09-13' }, assignments: [assign('2026-09-10', 'v1')] }),
    )
    expect(t.rows).toEqual([[null], [11200]])
  })

  it('partial, sobald ein Tag der Woche unbekannte Werte hat', () => {
    const t = exportTable(
      'weeks',
      cols('fiber'),
      input({
        range: { from: '2026-09-07', to: '2026-09-13' },
        entries: [entry('2026-09-07', 'fr', 'A', { fiber: 5 }), entry('2026-09-08', 'fr', 'B', { fiber: null })],
      }),
    )
    expect(t.rows).toEqual([[5, ['fiber_g']]])
  })
})

describe('CSV', () => {
  it('Kopfzeile, Komma, Punkt, leer für null, partial mit Semikolon', () => {
    const csv = toCsv({
      level: 'days',
      keys: ['date', 'complete', 'kcal', 'salt_g', 'partial'],
      rows: [
        ['2026-09-01', true, 2911, 5.12, ['fiber_g', 'salt_g']],
        ['2026-09-02', false, null, null, []],
      ],
    })
    expect(csv).toBe('date,complete,kcal,salt_g,partial\n2026-09-01,true,2911,5.12,fiber_g;salt_g\n2026-09-02,false,,,\n')
  })

  it('Komma und Anführungszeichen im Namen werden maskiert', () => {
    const csv = toCsv({ level: 'entries', keys: ['name'], rows: [['Milch, 3,5 %'], ['Joghurt "Natur"'], ['Brot']] })
    expect(csv).toBe('name\n"Milch, 3,5 %"\n"Joghurt ""Natur"""\nBrot\n')
  })

  it('Vorschau mit Grenze', () => {
    const csv = toCsv({ level: 'days', keys: ['kcal'], rows: [[1], [2], [3]] }, 2)
    expect(csv).toBe('kcal\n1\n2\n…\n')
  })
})

describe('JSON', () => {
  const meta = { range: september, exportedAt: '2026-10-25T14:02:11.000Z' }
  const table = {
    level: 'days' as const,
    keys: ['date', 'kcal', 'partial'],
    rows: [
      ['2026-09-01', 2911, ['fiber_g']],
      ['2026-09-02', null, []],
    ],
  }

  it('Kopf und Zeilen; partial nur, wenn etwas fehlt', () => {
    expect(JSON.parse(toJson(table, meta))).toEqual({
      app: 'kcalm',
      exportVersion: 1,
      exportedAt: '2026-10-25T14:02:11.000Z',
      from: '2026-09-01',
      to: '2026-09-30',
      level: 'days',
      rows: [
        { date: '2026-09-01', kcal: 2911, partial: ['fiber_g'] },
        { date: '2026-09-02', kcal: null },
      ],
    })
  })

  it('partial in einer Zeile, auch Namen mit Komma bleiben unverändert', () => {
    const text = toJson(
      { level: 'days', keys: ['name', 'partial'], rows: [['a, b', ['fiber_g', 'salt_g']]] },
      meta,
    )
    expect(text).toContain('"partial": ["fiber_g", "salt_g"]')
    expect(JSON.parse(text).rows).toEqual([{ name: 'a, b', partial: ['fiber_g', 'salt_g'] }])
  })

  it('Vorschau deutet weitere Zeilen an', () => {
    const text = toJson(table, meta, 1)
    expect(text).toContain('"date": "2026-09-01"')
    expect(text).not.toContain('2026-09-02')
    expect(text.endsWith('    },\n    …\n  ]\n}\n')).toBe(true)
  })

  it('leere Zeilen bleiben gültiges JSON', () => {
    expect(JSON.parse(toJson({ level: 'days', keys: ['date'], rows: [] }, meta, 2)).rows).toEqual([])
  })
})

describe('Datei und Knopf', () => {
  it('Dateiname nach Ebene und Zeitraum', () => {
    expect(exportFileName('days', september, 'json')).toBe('kcalm-tage_2026-09-01_2026-09-30.json')
    expect(exportFileName('entries', september, 'csv')).toBe('kcalm-eintraege_2026-09-01_2026-09-30.csv')
  })

  it('Datei mit passendem Typ', () => {
    const t = exportTable('days', nutrientCols, input())
    const meta = { range: september, exportedAt: '2026-10-25T14:02:11.000Z' }
    expect(exportFile(t, 'csv', meta).type).toBe('text/csv;charset=utf-8')
    expect(exportFile(t, 'json', meta).type).toBe('application/json')
    expect(exportFile(t, 'csv', meta).text.split('\n')).toHaveLength(32)
  })

  it('Knopf mit Anzahl und Singular', () => {
    expect(shareLabel(exportTable('days', nutrientCols, input()), 'json')).toBe('30 Tage als JSON teilen')
    expect(shareLabel({ level: 'entries', keys: [], rows: [[]] }, 'csv')).toBe('1 Eintrag als CSV teilen')
    expect(shareLabel({ level: 'entries', keys: [], rows: Array(1200).fill([]) }, 'csv')).toBe('1.200 Einträge als CSV teilen')
    expect(shareLabel({ level: 'weeks', keys: [], rows: [] }, 'csv')).toBe('0 Wochen als CSV teilen')
  })
})

describe('Vorlage', () => {
  const tpl: ExportSettings = { ...CLAUDE_TEMPLATE, columns: new Set(CLAUDE_TEMPLATE.columns) }

  it('Spalten wie im Plan', () => {
    const t = exportTable('days', CLAUDE_TEMPLATE.columns, input())
    expect(t.keys).toEqual([
      'date', 'complete', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'budget_kcal', 'weight_kg', 'partial',
    ])
  })

  it('genau die Vorlage → erkannt', () => {
    expect(isTemplate(tpl, WEIGHT)).toBe(true)
  })

  it('eine Spalte mehr, weniger oder andere Einstellung → nicht', () => {
    expect(isTemplate({ ...tpl, columns: new Set([...tpl.columns, 'salt']) }, WEIGHT)).toBe(false)
    expect(isTemplate({ ...tpl, columns: new Set([...tpl.columns].filter((c) => c !== 'fat')) }, WEIGHT)).toBe(false)
    expect(isTemplate({ ...tpl, format: 'csv' }, WEIGHT)).toBe(false)
    expect(isTemplate({ ...tpl, range: 'weeks4' }, WEIGHT)).toBe(false)
    expect(isTemplate({ ...tpl, level: 'weeks' }, WEIGHT)).toBe(false)
  })

  it('ohne Verbrauchsschätzung zählt Gewicht nicht', () => {
    expect(isTemplate({ ...tpl, columns: new Set([...tpl.columns].filter((c) => c !== 'weight')) }, NONE)).toBe(true)
    expect(isTemplate(tpl, NONE)).toBe(true)
  })

  it('auf anderen Ebenen gewählte Spalten (Slot, Name) stören nicht', () => {
    expect(isTemplate({ ...tpl, columns: new Set([...tpl.columns, 'slot', 'name']) }, WEIGHT)).toBe(true)
  })
})

describe('Runden', () => {
  it('wie die Anzeige, ohne −0', () => {
    expect(roundTo(223.2, 0)).toBe(223)
    expect(roundTo(0.125, 2)).toBe(0.13)
    expect(roundTo(-0.04, 1)).toBe(0)
    expect(Object.is(roundTo(-0.04, 1), -0)).toBe(false)
  })
})
