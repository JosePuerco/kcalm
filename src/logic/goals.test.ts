import { describe, expect, it } from 'vitest'
import type { MacroTarget } from '../db/types.ts'
import { formatNumber } from './format.ts'
import {
  dynamicDailyTarget,
  dynamicTargetFor,
  fixedDailyTarget,
  macroGoals,
  validateMacroModes,
  weekStatus,
} from './goals.ts'

// Woche Mo 19.10. – So 25.10.2026; Mo–Mi zusammen 8.900 kcal wie in PLAN.md
const week = {
  '2026-10-19': 2950,
  '2026-10-20': 3100,
  '2026-10-21': 2850,
}

describe('fixedDailyTarget', () => {
  it('PLAN.md: 19.600 ÷ 7 = 2.800', () => {
    expect(fixedDailyTarget(19600)).toBe(2800)
  })

  it('rundet intern nicht', () => {
    expect(fixedDailyTarget(15000)).toBeCloseTo(2142.857142857, 6)
    expect(formatNumber(fixedDailyTarget(15000))).toBe('2.143')
  })
})

describe('dynamicDailyTarget', () => {
  it('PLAN.md: Mo–Mi 8.900 → Do (19.600 − 8.900) ÷ 4 = 2.675', () => {
    expect(dynamicDailyTarget(19600, 8900, 4)).toBe(2675)
  })

  it('am Montag gleich dem festen Ziel', () => {
    expect(dynamicDailyTarget(19600, 0, 7)).toBe(2800)
  })

  it('am Sonntag das ganze Restbudget', () => {
    expect(dynamicDailyTarget(19600, 17000, 1)).toBe(2600)
  })

  it('Budget überschritten: negativ, nicht abgeschnitten', () => {
    expect(dynamicDailyTarget(19600, 20000, 2)).toBe(-200)
  })

  it('lehnt unsinnige Tageszahlen ab', () => {
    expect(() => dynamicDailyTarget(19600, 0, 0)).toThrow(RangeError)
    expect(() => dynamicDailyTarget(19600, 0, 8)).toThrow(RangeError)
    expect(() => dynamicDailyTarget(19600, 0, 2.5)).toThrow(RangeError)
  })
})

describe('dynamicTargetFor', () => {
  const today = '2026-10-22' // Donnerstag

  it('heute: Vortage dieser Woche zählen (PLAN.md-Beispiel)', () => {
    expect(dynamicTargetFor(today, today, { ...week, [today]: 1200 }, 19600)).toBe(2675)
  })

  it('der heutige Verbrauch ändert das heutige Ziel nicht', () => {
    expect(dynamicTargetFor(today, today, week, 19600)).toBe(dynamicTargetFor(today, today, { ...week, [today]: 3000 }, 19600))
  })

  it('vergangener Tag: so, wie das Ziel an dem Tag war', () => {
    // Mi: (19.600 − 2.950 − 3.100) ÷ 5 = 2.710
    expect(dynamicTargetFor('2026-10-21', today, week, 19600)).toBe(2710)
    expect(dynamicTargetFor('2026-10-19', today, week, 19600)).toBe(2800)
  })

  it('künftiger Tag dieser Woche: wie heute, vorgeplante Einträge zählen nicht', () => {
    const planned = { ...week, [today]: 1000, '2026-10-24': 4000 }
    expect(dynamicTargetFor('2026-10-24', today, planned, 19600)).toBe(2675)
  })

  it('Tag in einer künftigen Woche: Budget ÷ 7', () => {
    expect(dynamicTargetFor('2026-10-28', today, week, 19600)).toBe(2800)
  })

  it('vergangene Woche: rechnet mit den Tagen jener Woche', () => {
    const last = { '2026-10-12': 3000, '2026-10-13': 3000 }
    // Mi 14.10.: (19.600 − 6.000) ÷ 5 = 2.720
    expect(dynamicTargetFor('2026-10-14', today, last, 19600)).toBe(2720)
  })

  it('Tage anderer Wochen zählen nicht mit', () => {
    const withLastSunday = { ...week, '2026-10-18': 5000 }
    expect(dynamicTargetFor(today, today, withLastSunday, 19600)).toBe(2675)
  })

  it('countFrom: Tage vor dem ersten Profil zählen nicht', () => {
    // Profil ab Mi, Budget Mi–So 14.000 → Do: (14.000 − 2.850) ÷ 4
    expect(dynamicTargetFor(today, today, week, 14000, { countFrom: '2026-10-21' })).toBe(2787.5)
  })

  it('leere Vortage zählen als 0', () => {
    expect(dynamicTargetFor(today, today, {}, 19600)).toBe(4900)
  })
})

describe('weekStatus', () => {
  it('Summe bis heute, 7 Tage Mo–So, Restbudget', () => {
    const s = weekStatus('2026-10-22', '2026-10-22', { ...week, '2026-10-22': 1402 }, 19600)
    expect(s.days.map((d) => d.date)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ])
    expect(s.consumed).toBe(10302)
    expect(s.remaining).toBe(9298)
    expect(s.fixedTarget).toBe(2800)
    expect(s.days[3]?.isToday).toBe(true)
    expect(s.days.filter((d) => d.isFuture)).toHaveLength(3)
  })

  it('vorgeplante Tage erscheinen als Balken, zählen aber nicht zur Summe', () => {
    const s = weekStatus('2026-10-22', '2026-10-22', { ...week, '2026-10-24': 2000 }, 19600)
    expect(s.days[5]?.kcal).toBe(2000)
    expect(s.consumed).toBe(8900)
  })

  it('angezeigter Tag in vergangener Woche: alle 7 Tage zählen', () => {
    const s = weekStatus('2026-10-14', '2026-10-22', { '2026-10-18': 2500 }, 19600)
    expect(s.days.every((d) => !d.isFuture)).toBe(true)
    expect(s.consumed).toBe(2500)
  })

  it('countFrom und festes Ziel aus der Version', () => {
    const s = weekStatus('2026-10-22', '2026-10-22', week, 14000, { countFrom: '2026-10-21', weeklyKcal: 19600 })
    expect(s.consumed).toBe(2850)
    expect(s.fixedTarget).toBe(2800)
  })

  it('drüber: Rest negativ', () => {
    expect(weekStatus('2026-10-22', '2026-10-22', { '2026-10-19': 21000 }, 19600).remaining).toBe(-1400)
  })
})

const g = (value: number): MacroTarget => ({ mode: 'g', value })
const pct = (value: number): MacroTarget => ({ mode: 'percent', value })
const perKg = (value: number): MacroTarget => ({ mode: 'gPerKg', value })
const rest: MacroTarget = { mode: 'rest', value: null }

describe('macroGoals', () => {
  // Beispiel-Profil aus PLAN.md / Start.dc.html: Eiweiß 1,8 g/kg, Fett 25 %, KH Rest
  const aufbau = { weeklyKcal: 19600, protein: perKg(1.8), fat: pct(25), carbs: rest }

  it('PLAN.md: Fett 25 % von 2.800 = 77,8 g', () => {
    const r = macroGoals(aufbau, 74)
    expect(r.grams.fat).toBeCloseTo(77.777777, 5)
    expect(formatNumber(r.grams.fat, 1)).toBe('77,8')
  })

  it('PLAN.md: Eiweiß 1,8 g/kg × 74,0 kg = 133,2 g', () => {
    expect(macroGoals(aufbau, 74).grams.protein).toBeCloseTo(133.2, 10)
  })

  it('PLAN.md: KH Rest ≈ 392 g, exakt mit ungerundeten anderen Makros', () => {
    const r = macroGoals(aufbau, 74)
    // (2.800 − 133,2 × 4 − 77,78 × 9) ÷ 4 = 391,8
    expect(r.grams.carbs).toBeCloseTo(391.8, 10)
    expect(formatNumber(r.grams.carbs)).toBe('392')
    expect(r.issues).toEqual([])
  })

  it('Eiweiß in % teilt durch 4', () => {
    expect(macroGoals({ weeklyKcal: 19600, protein: pct(20), fat: g(80), carbs: rest }, null).grams.protein).toBe(140)
  })

  it('alles in Gramm', () => {
    const r = macroGoals({ weeklyKcal: 19600, protein: g(150), fat: g(80), carbs: g(300) }, null)
    expect(r.grams).toEqual({ protein: 150, fat: 80, carbs: 300 })
  })

  it('Rest kann auch Fett sein (÷ 9)', () => {
    const r = macroGoals({ weeklyKcal: 19600, protein: g(150), fat: rest, carbs: g(300) }, null)
    // (2.800 − 600 − 1.200) ÷ 9
    expect(r.grams.fat).toBeCloseTo(111.111, 3)
  })

  it('ohne Rest-Makro bleibt alles wie eingestellt', () => {
    const r = macroGoals({ weeklyKcal: 19600, protein: pct(30), fat: pct(30), carbs: pct(40) }, null)
    expect(r.grams.protein).toBe(210)
    expect(r.grams.fat).toBeCloseTo(93.333, 3)
    expect(r.grams.carbs).toBe(280)
  })

  it('g/kg ohne Gewicht: unbekannt, und damit auch der Rest', () => {
    const r = macroGoals(aufbau, null)
    expect(r.grams.protein).toBeNull()
    expect(r.grams.carbs).toBeNull()
    expect(r.grams.fat).not.toBeNull()
    expect(r.issues).toEqual(['missingWeight'])
  })

  it('Gewicht 0 zählt wie fehlend', () => {
    expect(macroGoals(aufbau, 0).issues).toEqual(['missingWeight'])
  })

  it('Rest negativ: 0 g und Hinweis', () => {
    const r = macroGoals({ weeklyKcal: 14000, protein: g(250), fat: g(120), carbs: rest }, null)
    expect(r.grams.carbs).toBe(0)
    expect(r.issues).toEqual(['restNegative'])
  })

  it('Rest genau 0 ist kein Fehler', () => {
    const r = macroGoals({ weeklyKcal: 14000, protein: g(200), fat: g(1200 / 9), carbs: rest }, null)
    expect(r.grams.carbs).toBeCloseTo(0, 10)
    expect(r.issues).toEqual([])
  })

  it('ungültige Einstellung wirft', () => {
    expect(() => macroGoals({ weeklyKcal: 19600, protein: rest, fat: g(80), carbs: rest }, null)).toThrow(RangeError)
  })
})

describe('validateMacroModes', () => {
  it('gültig', () => {
    expect(validateMacroModes({ protein: perKg(1.8), fat: pct(25), carbs: rest })).toBeNull()
    expect(validateMacroModes({ protein: g(0), fat: perKg(1), carbs: g(200) })).toBeNull()
  })

  it('höchstens ein Rest', () => {
    expect(validateMacroModes({ protein: g(150), fat: rest, carbs: rest })).toMatch(/Rest/)
  })

  it('g/kg nicht für Kohlenhydrate', () => {
    expect(validateMacroModes({ protein: g(150), fat: g(80), carbs: perKg(4) })).toMatch(/g\/kg/)
  })

  it('fehlender oder negativer Wert', () => {
    expect(validateMacroModes({ protein: { mode: 'g', value: null }, fat: g(80), carbs: rest })).toMatch(/Wert/)
    expect(validateMacroModes({ protein: g(-1), fat: g(80), carbs: rest })).toMatch(/Wert/)
    expect(validateMacroModes({ protein: g(Number.NaN), fat: g(80), carbs: rest })).toMatch(/Wert/)
  })
})
