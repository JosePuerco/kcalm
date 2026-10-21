// OFF-Textsuche unter den lokalen Treffern (Kern.dc.html: gestrichelter Knopf „In Open Food Facts suchen“).
// Nur auf Knopfdruck (PLAN.md 2); die Treffer gehören zum Suchbegriff, ein neuer Begriff blendet sie aus.
import { useState } from 'react'
import { IconChevronRight } from '../../components/icons/icons.tsx'
import { searchOff } from '../../db/off.ts'
import { offResultLabels, type OffProduct } from '../../logic/off.ts'

type Result =
  | { kind: 'loading' }
  | { kind: 'results'; products: OffProduct[] }
  | { kind: 'offline' }
  | { kind: 'unreachable' }

const MESSAGES = {
  offline: 'Kein Internet. Die Suche in Open Food Facts braucht eine Verbindung.',
  unreachable: 'Open Food Facts antwortet gerade nicht. Versuch es gleich nochmal.',
  empty: 'Keine Treffer in Open Food Facts.',
}

export function OffSearch({ query, onPick }: { query: string; onPick: (product: OffProduct) => void }) {
  const term = query.trim()
  const [search, setSearch] = useState<{ term: string; result: Result } | null>(null)
  // Ergebnis nur zeigen, solange der Begriff derselbe ist
  const result = search?.term === term ? search.result : null

  const run = async () => {
    setSearch({ term, result: { kind: 'loading' } })
    const answer = await searchOff(term).catch((error: unknown) => {
      console.error(error)
      return { kind: 'unreachable' } as const
    })
    // Inzwischen anderer Begriff: Antwort verwerfen
    setSearch((current) => (current?.term === term ? { term, result: answer } : current))
  }

  const showButton = result === null || result.kind === 'loading' || result.kind === 'offline' || result.kind === 'unreachable'

  return (
    <>
      {result?.kind === 'results' && (
        <>
          <span className="text-small text-muted block px-1 pt-4 pb-1 tracking-[0.6px] uppercase">
            Treffer Open Food Facts
          </span>
          {result.products.length > 0 ? (
            <div className="bg-card rounded-card overflow-hidden">
              {result.products.map((p, i) => {
                const labels = offResultLabels(p)
                return (
                  <button
                    key={`${p.barcode ?? ''}-${i}`}
                    type="button"
                    onClick={() => onPick(p)}
                    className={`flex min-h-14 w-full items-center gap-2.5 px-3.5 py-2 text-left ${i > 0 ? 'border-line border-t' : ''}`}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-body font-medium break-words">{p.name}</span>
                      <span className="text-small text-muted">{labels.meta}</span>
                    </span>
                    <span className="text-secondary text-muted whitespace-nowrap">{labels.kcal}</span>
                    <IconChevronRight className="text-muted shrink-0" />
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-label text-muted px-1 pt-1">{MESSAGES.empty}</p>
          )}
        </>
      )}
      {(result?.kind === 'offline' || result?.kind === 'unreachable') && (
        <p role="status" className="text-label text-muted px-1 pt-3">
          {MESSAGES[result.kind]}
        </p>
      )}
      {showButton && (
        <button
          type="button"
          disabled={result?.kind === 'loading'}
          onClick={() => void run()}
          className="press rounded-field border-muted text-label text-muted mt-2.5 min-h-12 w-full border border-dashed text-center disabled:opacity-60"
        >
          {result?.kind === 'loading' ? 'Suche in Open Food Facts …' : 'In Open Food Facts suchen'}
        </button>
      )}
    </>
  )
}
