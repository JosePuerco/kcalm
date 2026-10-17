import { describe, expect, it } from 'vitest'
import { createSearchIndex, normalize, search } from './search.ts'

type Food = { name: string; brand?: string }
const foods: Food[] = [
  { name: 'Hafer Flocken' },
  { name: 'Hafer ganzes Korn, roh' },
  { name: 'Haferdrink', brand: 'Oatly' },
  { name: 'Skyr natur', brand: 'Arla' },
  { name: 'Käse, Gouda 48 % Fett i. Tr.' },
  { name: 'Äpfel roh' },
  { name: 'Weißkohl gegart' },
  { name: 'Müsli mit Früchten' },
  { name: 'Crème fraîche' },
  { name: 'Brot, Hafervollkorn' },
]
const index = createSearchIndex(foods, (f) => f.name, (f) => f.brand ?? '')
const names = (q: string, limit?: number) => search(index, q, limit).map((f) => f.name)

describe('normalize', () => {
  it('klein, ohne Satzzeichen, einfache Leerzeichen', () => {
    expect(normalize('  Käse, Gouda 48 % Fett ')).toBe('kase gouda 48 fett')
  })

  it('Umlaute: ä = ae = a, ß = ss', () => {
    expect(normalize('Äpfel')).toBe(normalize('Aepfel'))
    expect(normalize('Äpfel')).toBe('apfel')
    expect(normalize('Müsli')).toBe(normalize('Muesli'))
    expect(normalize('Weißkohl')).toBe(normalize('Weisskohl'))
  })

  it('entfernt Akzente', () => {
    expect(normalize('Crème fraîche')).toBe('creme fraiche')
  })
})

describe('search', () => {
  it('findet unabhängig von Groß-/Kleinschreibung und Umlauten', () => {
    expect(names('käse')).toEqual(['Käse, Gouda 48 % Fett i. Tr.'])
    expect(names('KAESE')).toEqual(['Käse, Gouda 48 % Fett i. Tr.'])
    expect(names('kase')).toEqual(['Käse, Gouda 48 % Fett i. Tr.'])
    expect(names('aepfel')).toEqual(['Äpfel roh'])
    expect(names('muesli')).toEqual(['Müsli mit Früchten'])
    expect(names('weisskohl')).toEqual(['Weißkohl gegart'])
    expect(names('creme')).toEqual(['Crème fraîche'])
  })

  it('jedes Wort muss vorkommen, Reihenfolge egal', () => {
    expect(names('hafer roh')).toEqual(['Hafer ganzes Korn, roh'])
    expect(names('roh hafer')).toEqual(['Hafer ganzes Korn, roh'])
    expect(names('hafer pizza')).toEqual([])
  })

  it('Namensanfang vor Wortanfang vor Wortmitte', () => {
    expect(names('hafer')).toEqual([
      'Haferdrink', // Anfang, kürzester Name
      'Hafer Flocken',
      'Hafer ganzes Korn, roh',
      'Brot, Hafervollkorn', // Wortanfang
    ])
  })

  it('findet Teile mitten im Wort', () => {
    expect(names('flock')).toEqual(['Hafer Flocken'])
    expect(names('vollkorn')).toEqual(['Brot, Hafervollkorn'])
  })

  it('sucht auch in der Marke', () => {
    expect(names('arla')).toEqual(['Skyr natur'])
    expect(names('oatly hafer')).toEqual(['Haferdrink'])
  })

  it('leere Suche oder nur Satzzeichen liefert nichts', () => {
    expect(names('')).toEqual([])
    expect(names('   ')).toEqual([])
    expect(names(',.%')).toEqual([])
  })

  it('Zahlen im Namen sind suchbar', () => {
    expect(names('48')).toEqual(['Käse, Gouda 48 % Fett i. Tr.'])
  })

  it('begrenzt die Trefferzahl', () => {
    expect(names('hafer', 2)).toEqual(['Haferdrink', 'Hafer Flocken'])
  })

  it('kommt mit vielen Einträgen schnell zurecht (BLS-Größe)', () => {
    const many = Array.from({ length: 7140 }, (_, i) => ({ name: `Lebensmittel ${i} roh` }))
    const big = createSearchIndex(many, (f) => f.name)
    const start = performance.now()
    for (let i = 0; i < 20; i++) search(big, 'lebensmittel 71', 30)
    expect((performance.now() - start) / 20).toBeLessThan(50)
  })
})
