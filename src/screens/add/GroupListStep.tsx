// Liste „Mahlzeiten“ bzw. „Rezepte“ im Hinzufügen-Sheet (Knöpfe unter dem Suchfeld, Kern.dc.html). Kein eigener
// Prototyp: Zeilen wie in der Lebensmittel-Liste; leer ein Hinweis mit Knopf zum Anlegen.
import { IconChevronRight } from '../../components/icons/icons.tsx'
import { Button } from '../../components/ui/Button.tsx'
import type { GroupRow } from '../../logic/groupList.ts'

type Props = {
  rows: GroupRow[]
  /** nicht wählbar, z. B. Rezept mit fehlender Zutat */
  disabled?: (row: GroupRow) => boolean
  empty: string
  createLabel: string
  onCreate: () => void
  onPick: (id: string) => void
}

export function GroupListStep({ rows, disabled, empty, createLabel, onCreate, onPick }: Props) {
  return (
    <div className="scroll-area px-screen-x pt-1 pb-[calc(24px+env(safe-area-inset-bottom))]">
      {rows.length > 0 ? (
        <div className="bg-card rounded-card overflow-hidden">
          {rows.map((row, i) => (
            <button
              key={row.id}
              type="button"
              disabled={disabled?.(row)}
              onClick={() => onPick(row.id)}
              className={`flex min-h-14 w-full items-center gap-2.5 px-3.5 py-2 text-left disabled:opacity-40 ${i > 0 ? 'border-line border-t' : ''}`}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-body font-medium break-words">{row.name}</span>
                <span className="text-small text-muted">{row.meta}</span>
              </span>
              <span className="text-secondary text-muted whitespace-nowrap">{row.value}</span>
              <IconChevronRight className="text-muted shrink-0" />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-label text-muted px-1 pt-1">{empty}</p>
          <Button variant="secondary" className="w-full" onClick={onCreate}>
            {createLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
