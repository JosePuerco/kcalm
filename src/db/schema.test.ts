import { describe, expect, it } from 'vitest'
import { SCHEMA_V1 } from './schema.ts'

const tables = Object.entries(SCHEMA_V1)
const indexes = (spec: string) => spec.split(',').map((s) => s.trim())

describe('SCHEMA_V1', () => {
  it('enthält alle 14 Tabellen aus PLAN.md', () => {
    expect(Object.keys(SCHEMA_V1).sort()).toEqual(
      [
        'products',
        'productOverrides',
        'blsPrefs',
        'meals',
        'recipes',
        'slots',
        'entries',
        'days',
        'profiles',
        'profileVersions',
        'profileAssignments',
        'weights',
        'pendingScans',
        'settings',
      ].sort(),
    )
  })

  it.each(tables)('%s: id als Primärschlüssel (UUID, nicht automatisch hochgezählt)', (_, spec) => {
    expect(indexes(spec)[0]).toBe('id')
  })

  it.each(tables)('%s: updatedAt ist indiziert (für späteren Sync)', (_, spec) => {
    expect(indexes(spec)).toContain('updatedAt')
  })

  it('eindeutige Schlüssel nur dort, wo upsertByKey wiederbelebt', () => {
    const unique = tables.filter(([, spec]) => spec.includes('&')).map(([name]) => name)
    expect(unique.sort()).toEqual(['blsPrefs', 'days', 'productOverrides', 'settings'])
  })

  it('keine Indizes auf archived oder deletedAt (in IndexedDB nicht suchbar)', () => {
    for (const [, spec] of tables) {
      expect(spec).not.toMatch(/archived|deletedAt/)
    }
  })
})
