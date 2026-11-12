import { describe, expect, it } from 'vitest'
import { newRecord, softDelete } from '../db/records.ts'
import type { Entry, LocalDate, MacroTarget, ProfileAssignment, ProfileVersion, Weight } from '../db/types.ts'
import { addDays } from './dates.ts'
import { dayOverview, kcalByDate } from './diary.ts'
import { dailyTrend, trendAt } from './estimate.ts'
import { goalFor } from './profiles.ts'
import { applyReceipts, pendingChanges, PUSH_TABLES, TARGETS_TABLE, type PushTables } from './push.ts'
import {
  dailyTargets,
  pendingTargetChanges,
  targetRange,
  trendByDay,
  type DailyTarget,
  type TargetInput,
} from './pushTargets.ts'

// Do 12.11.2026; Woche Mo 09.11. – So 15.11.
const TODAY = '2026-11-12'
const t0 = new Date('2026-11-01T08:00:00.000Z')

const g = (value: number): MacroTarget => ({ mode: 'g', value })
const rest: MacroTarget = { mode: 'rest', value: null }

function version(weeklyKcal: number, changes: Partial<ProfileVersion> = {}): ProfileVersion {
  return {
    ...newRecord<ProfileVersion>(
      {
        profileId: 'profil-diaet',
        weeklyKcal,
        protein: g(150),
        fat: { mode: 'percent', value: 30 },
        carbs: rest,
        fiberG: 30,
        manualWeightKg: null,
      },
      t0,
    ),
    ...changes,
  }
}

function assign(validFrom: LocalDate, v: ProfileVersion, weekBudgetOverride: number | null = null, at = t0) {
  return newRecord<ProfileAssignment>({ validFrom, profileVersionId: v.id, weekBudgetOverride }, at)
}

function eat(date: LocalDate, kcal: number | null): Entry {
  return newRecord<Entry>(
    {
      date,
      slotId: 's',
      kind: 'quick',
      ref: null,
      nameSnapshot: 'Schnelleintrag',
      amount: null,
      unit: null,
      portionLabel: null,
      nutrients: { kcal, fat: null, satFat: null, carbs: null, sugar: null, fiber: null, protein: null, salt: null },
      mealGroupId: null,
      mealName: null,
      cost: null,
    },
    t0,
  )
}

function weigh(date: LocalDate, kg: number): Weight {
  return newRecord<Weight>({ date, kg, source: 'manual', measuredAt: `${date}T06:00:00.000Z` }, t0)
}

function input(changes: Partial<TargetInput>): TargetInput {
  return { assignments: [], versions: [], entries: [], weights: [], estimateEnabled: false, today: TODAY, ...changes }
}

const byDate = (rows: DailyTarget[]) => new Map(rows.map((r) => [r.date, r]))

describe('targetRange', () => {
  it('ohne Profil kein Zeitraum', () => {
    expect(targetRange([], TODAY)).toBeNull()
  })

  it('vom ersten Profil bis Sonntag der laufenden Woche, gelöschte Zuweisungen zählen nicht', () => {
    const v = version(14000)
    const old = softDelete(assign('2026-01-01', v), t0)
    expect(targetRange([old, assign('2026-11-03', v)], TODAY)).toEqual({ from: '2026-11-03', to: '2026-11-15' })
  })

  it('Profil erst ab nächster Woche → noch nichts', () => {
    expect(targetRange([assign('2026-11-16', version(14000))], TODAY)).toBeNull()
  })

  it('Profil ab Sonntag dieser Woche → genau ein Tag', () => {
    expect(targetRange([assign('2026-11-15', version(14000))], TODAY)).toEqual({ from: '2026-11-15', to: '2026-11-15' })
  })
})

describe('dailyTargets', () => {
  it('ohne Profil keine Zeilen', () => {
    expect(dailyTargets(input({ entries: [eat(TODAY, 500)] }))).toEqual([])
  })

  it('Grundfall: festes und dynamisches Ziel, Vortage zählen, heute und Zukunft nicht', () => {
    const v = version(14000)
    const rows = byDate(
      dailyTargets(
        input({
          versions: [v],
          assignments: [assign('2026-11-09', v)],
          entries: [eat('2026-11-09', 2500), eat('2026-11-10', 1500), eat('2026-11-11', 2000), eat(TODAY, 900), eat('2026-11-13', 3000)],
        }),
      ),
    )
    expect([...rows.keys()]).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'])
    expect(rows.get('2026-11-09')).toMatchObject({ fixedTarget: 2000, dynamicTarget: 2000, weekBudget: 14000, weeklyKcal: 14000 })
    expect(rows.get('2026-11-10')!.dynamicTarget).toBe((14000 - 2500) / 6)
    expect(rows.get(TODAY)!.dynamicTarget).toBe((14000 - 6000) / 4)
    // Zukunft in dieser Woche: das heutige Ziel ohne heutigen Verbrauch, vorgeplante Einträge zählen nicht
    expect(rows.get('2026-11-13')!.dynamicTarget).toBe((14000 - 6000) / 4)
    expect(rows.get('2026-11-15')!.dynamicTarget).toBe((14000 - 6000) / 4)
  })

  it('rechnet exakt, ohne zu runden', () => {
    const v = version(14000)
    const rows = dailyTargets(input({ versions: [v], assignments: [assign('2026-11-09', v)], entries: [eat('2026-11-09', 1000)] }))
    expect(byDate(rows).get('2026-11-10')!.dynamicTarget).toBe(13000 / 6)
  })

  it('Löschmarker und unbekannte kcal: gelöschte Einträge zählen nicht, null zählt als 0', () => {
    const v = version(14000)
    const rows = byDate(
      dailyTargets(
        input({
          versions: [v],
          assignments: [assign('2026-11-09', v)],
          entries: [softDelete(eat('2026-11-09', 5000), t0), eat('2026-11-09', null), eat('2026-11-09', 700)],
        }),
      ),
    )
    expect(rows.get('2026-11-10')!.dynamicTarget).toBe((14000 - 700) / 6)
  })

  it('Tage vor dem ersten Profil fehlen und zählen nicht gegen das Budget der Restwoche', () => {
    const v = version(14000)
    const rows = byDate(
      dailyTargets(input({ versions: [v], assignments: [assign('2026-11-11', v)], entries: [eat('2026-11-09', 9000)] })),
    )
    expect(rows.has('2026-11-10')).toBe(false)
    expect(rows.get('2026-11-11')!.dynamicTarget).toBe(14000 / 5)
  })

  it('Wechsel „ab heute“ mit anteiligem Budget gilt nur in dieser Woche', () => {
    const alt = version(14000)
    const neu = version(17500, { profileId: 'profil-aufbau' })
    const rows = byDate(
      dailyTargets(
        input({
          today: '2026-11-19',
          versions: [alt, neu],
          assignments: [assign('2026-11-09', alt), assign(TODAY, neu, 16000)],
        }),
      ),
    )
    expect(rows.get('2026-11-11')).toMatchObject({ profileId: 'profil-diaet', profileVersionId: alt.id, weekBudget: 14000 })
    expect(rows.get(TODAY)).toMatchObject({ profileId: 'profil-aufbau', profileVersionId: neu.id, weekBudget: 16000, fixedTarget: 2500 })
    expect(rows.get('2026-11-16')).toMatchObject({ weekBudget: 17500 })
  })

  it('Makroziele: g, %, Rest und Ballaststoffe', () => {
    const v = version(14000)
    const row = dailyTargets(input({ versions: [v], assignments: [assign('2026-11-09', v)] }))[0]!
    expect(row.proteinG).toBe(150)
    expect(row.fatG).toBe((2000 * 30) / 100 / 9)
    expect(row.carbsG).toBe((2000 - 150 * 4 - 600) / 4)
    expect(row.fiberG).toBe(30)
  })

  it('g/kg ohne Gewicht → null, mit manuellem Gewicht → berechnet', () => {
    const ohne = version(14000, { protein: { mode: 'gPerKg', value: 2 } })
    const r1 = dailyTargets(input({ versions: [ohne], assignments: [assign('2026-11-09', ohne)] }))[0]!
    expect(r1).toMatchObject({ proteinG: null, carbsG: null, weightKg: null })

    const mit = version(14000, { protein: { mode: 'gPerKg', value: 2 }, manualWeightKg: 80 })
    const r2 = dailyTargets(input({ versions: [mit], assignments: [assign('2026-11-09', mit)] }))[0]!
    expect(r2).toMatchObject({ proteinG: 160, weightKg: 80 })
  })

  it('Trendgewicht nur bei aktiver Schätzung, sonst das manuelle Gewicht', () => {
    const v = version(14000, { protein: { mode: 'gPerKg', value: 2 }, manualWeightKg: 80 })
    const base = { versions: [v], assignments: [assign('2026-11-09', v)], weights: [weigh('2026-11-09', 90)] }
    expect(dailyTargets(input({ ...base, estimateEnabled: false }))[0]!.weightKg).toBe(80)
    expect(dailyTargets(input({ ...base, estimateEnabled: true }))[0]!.weightKg).toBe(90)
  })

  it('Trendgewicht eines Tages hängt nur von Wiegungen bis zu diesem Tag ab (wie im Tagebuch)', () => {
    const v = version(14000, { protein: { mode: 'gPerKg', value: 2 } })
    const base = { versions: [v], assignments: [assign('2026-11-09', v)], estimateEnabled: true }
    const vorher = byDate(dailyTargets(input({ ...base, weights: [weigh('2026-11-01', 80)] })))
    const nachher = byDate(dailyTargets(input({ ...base, weights: [weigh('2026-11-01', 80), weigh('2026-11-11', 70)] })))
    expect(nachher.get('2026-11-10')!.weightKg).toBe(vorher.get('2026-11-10')!.weightKg)
    expect(nachher.get('2026-11-11')!.weightKg).not.toBe(vorher.get('2026-11-11')!.weightKg)
  })

  it('gelöschte Wiegungen zählen nicht', () => {
    const v = version(14000, { manualWeightKg: 80 })
    const rows = dailyTargets(
      input({ versions: [v], assignments: [assign('2026-11-09', v)], estimateEnabled: true, weights: [softDelete(weigh('2026-11-09', 95), t0)] }),
    )
    expect(rows[0]!.weightKg).toBe(80)
  })

  it('stimmt an jedem Tag mit der Übersicht im Tagebuch überein', () => {
    const alt = version(14000, { protein: { mode: 'gPerKg', value: 1.8 }, manualWeightKg: 82 })
    const neu = version(17500, { profileId: 'profil-aufbau', fat: { mode: 'gPerKg', value: 1 }, protein: { mode: 'percent', value: 25 } })
    const assignments = [assign('2026-10-28', alt), assign('2026-11-04', neu, 15800)]
    const versions = [alt, neu]
    const weights = [weigh('2026-10-20', 84), weigh('2026-10-30', 83.1), weigh('2026-11-06', 82.4), weigh('2026-11-11', 81.9)]
    const entries: Entry[] = []
    for (let d = '2026-10-26'; d <= '2026-11-15'; d = addDays(d, 1)) entries.push(eat(d, 1500 + (d.charCodeAt(9) % 7) * 210))

    const rows = dailyTargets({ assignments, versions, entries, weights, estimateEnabled: true, today: TODAY })
    expect(rows[0]!.date).toBe('2026-10-28')
    expect(rows.at(-1)!.date).toBe('2026-11-15')

    const weekKcal = kcalByDate(entries)
    for (const row of rows) {
      const goal = goalFor(assignments, versions, row.date)!
      const trendKg = trendAt(dailyTrend(weights, row.date), row.date)
      const app = dayOverview(
        row.date,
        TODAY,
        entries.filter((e) => e.date === row.date),
        weekKcal,
        { version: goal.version, weekBudget: goal.weekBudget, countFrom: goal.countFrom, trendKg },
      )
      const macro = (k: string) => app.macros.find((m) => m.key === k)!.goal
      expect(row.dynamicTarget, row.date).toBe(app.target)
      expect(row.fixedTarget, row.date).toBe(app.week!.fixedTarget)
      expect(row.weekBudget, row.date).toBe(app.week!.budget)
      expect([row.proteinG, row.fatG, row.carbsG, row.fiberG], row.date).toEqual([
        macro('protein'),
        macro('fat'),
        macro('carbs'),
        macro('fiber'),
      ])
    }
  })
})

describe('trendByDay', () => {
  it('ergibt an jedem Tag denselben Wert wie der Trend bis zu diesem Tag', () => {
    const weights = [
      weigh('2026-09-03', 84.2),
      weigh('2026-09-04', 83.9),
      { ...weigh('2026-09-04', 90), measuredAt: '2026-09-04T20:00:00.000Z' }, // spätere Wiegung am Tag zählt nicht
      weigh('2026-09-20', 82.7), // Lücke
      weigh('2026-10-02', 83.4),
      weigh('2026-10-03', 81.8),
      weigh('2026-11-01', 81.1),
    ]
    const fast = trendByDay(weights, '2026-11-15')
    for (let d = '2026-08-30'; d <= '2026-11-15'; d = addDays(d, 1)) {
      expect(fast(d), d).toBe(trendAt(dailyTrend(weights, d), d))
    }
  })

  it('ohne Wiegungen immer null', () => {
    expect(trendByDay([], TODAY)(TODAY)).toBeNull()
  })
})

describe('pendingTargetChanges', () => {
  const v = version(14000)
  const base = input({ versions: [v], assignments: [assign('2026-11-09', v)], entries: [eat('2026-11-09', 2000)] })

  it('erstes Mal: alle Tage als upsert in der Tabelle dailyTargets, id = Datum', () => {
    const changes = pendingTargetChanges(dailyTargets(base), [])
    expect(changes).toHaveLength(7)
    expect(changes[0]).toMatchObject({ op: 'upsert', table: TARGETS_TABLE, id: '2026-11-09', record: { date: '2026-11-09' } })
  })

  it('nach Quittung nichts mehr; nachgetragener Eintrag ändert nur die Folgetage', () => {
    const receipts = applyReceipts([], pendingTargetChanges(dailyTargets(base), []))
    expect(pendingTargetChanges(dailyTargets(base), receipts)).toEqual([])

    const later = { ...base, entries: [...base.entries, eat('2026-11-10', 1000)] }
    const ids = pendingTargetChanges(dailyTargets(later), receipts).map((c) => c.id)
    expect(ids).toEqual(['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'])
  })

  it('neuer Tag: die bisher künftigen Tage dieser Woche ändern sich, vergangene nicht', () => {
    const receipts = applyReceipts([], pendingTargetChanges(dailyTargets(base), []))
    // Do → Fr: Fr–So rechneten ab Do (12.000 ÷ 4), jetzt ab Fr (12.000 ÷ 3); Mo–Do bleiben
    const tomorrow = { ...base, today: '2026-11-13' }
    const changes = pendingTargetChanges(dailyTargets(tomorrow), receipts)
    expect(changes.map((c) => c.id)).toEqual(['2026-11-13', '2026-11-14', '2026-11-15'])
    expect(changes[0]).toMatchObject({ record: { dynamicTarget: 4000 } })

    // Neue Woche: dazu die sieben neuen Tage
    const nextWeek = { ...base, today: '2026-11-16' }
    const ids = pendingTargetChanges(dailyTargets(nextWeek), receipts).map((c) => c.id)
    expect(ids).toEqual(['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'])
  })

  it('Profil gelöscht → Tage als entfernt', () => {
    const receipts = applyReceipts([], pendingTargetChanges(dailyTargets(base), []))
    const gone = { ...base, assignments: base.assignments.map((a) => softDelete(a, t0)) }
    const changes = pendingTargetChanges(dailyTargets(gone), receipts)
    expect(changes).toHaveLength(7)
    expect(changes.every((c) => c.op === 'remove' && c.table === TARGETS_TABLE)).toBe(true)
  })

  it('Datensätze und Tagesziele stören sich in der Quittungsliste nicht', () => {
    const receipts = applyReceipts([], pendingTargetChanges(dailyTargets(base), []))
    const empty = Object.fromEntries(PUSH_TABLES.map((t) => [t, []])) as unknown as PushTables
    expect(pendingChanges(empty, receipts)).toEqual([])
    const entryReceipts = applyReceipts([], pendingChanges({ ...empty, entries: [...base.entries] }, []))
    expect(pendingTargetChanges(dailyTargets(base), [...receipts, ...entryReceipts])).toEqual([])
  })
})
