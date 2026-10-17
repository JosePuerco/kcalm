// Lokale Suche über eigene Produkte und BLS: sofort, offline, ohne Bibliothek.

/**
 * Für den Vergleich vereinheitlichen: klein, ohne Akzente, ä = ae = a, ß = ss,
 * Satzzeichen werden Leerzeichen. Name und Suchtext gehen durch dieselbe Funktion.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Akzente und Umlaut-Punkte entfernen: ä → a
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export interface SearchIndex<T> {
  entries: { item: T; text: string; name: string }[]
}

/** Einmal vorbereiten (z. B. 7.140 BLS-Einträge), dann beliebig oft suchen */
export function createSearchIndex<T>(items: readonly T[], getName: (item: T) => string, getExtra?: (item: T) => string) {
  return {
    entries: items.map((item) => {
      const name = normalize(getName(item))
      const extra = getExtra ? normalize(getExtra(item)) : ''
      return { item, name, text: extra ? `${name} ${extra}` : name }
    }),
  } satisfies SearchIndex<T>
}

/** 0 = Name beginnt damit, 1 = ein Wort beginnt damit, 2 = irgendwo enthalten, null = kein Treffer */
function wordScore(text: string, name: string, word: string): number | null {
  if (name.startsWith(word)) return 0
  if (` ${text}`.includes(` ${word}`)) return 1
  if (text.includes(word)) return 2
  return null
}

/**
 * Jedes Suchwort muss vorkommen (Name oder Zusatz, z. B. Marke).
 * Reihenfolge: bessere Treffer zuerst, dann kürzere Namen, dann alphabetisch.
 */
export function search<T>(index: SearchIndex<T>, query: string, limit = Infinity): T[] {
  const words = normalize(query).split(' ').filter(Boolean)
  if (words.length === 0) return []

  const hits: { item: T; score: number; name: string }[] = []
  for (const entry of index.entries) {
    let score = 0
    let match = true
    for (const word of words) {
      const s = wordScore(entry.text, entry.name, word)
      if (s === null) {
        match = false
        break
      }
      score += s
    }
    if (match) hits.push({ item: entry.item, score, name: entry.name })
  }

  hits.sort((a, b) => a.score - b.score || a.name.length - b.name.length || a.name.localeCompare(b.name, 'de'))
  return hits.slice(0, limit).map((h) => h.item)
}
