// Ersatz, wenn die Zwischenablage nicht gelesen werden kann oder ihr Inhalt nicht passt:
// Text vom Kurzbefehl selbst ins Feld einfügen und übernehmen. Eigenes Design (kein Prototyp).
import { useState } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { Sheet } from '../../../components/ui/Sheet.tsx'
import { importWeights } from '../../../db/weights.ts'
import { importMessage } from '../../../logic/estimateView.ts'

type Props = {
  open: boolean
  /** Fehler aus dem Versuch mit der Zwischenablage */
  initialError: string | null
  onClose: () => void
  onImported: (message: string) => void
}

export function PasteSheet({ open, initialError, onClose, onImported }: Props) {
  const [text, setText] = useState('')
  // Beim Öffnen bekommt das Sheet einen neuen key (EstimateScreen), daher reicht der Startwert
  const [error, setError] = useState<string | null>(initialError)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      const result = await importWeights(text)
      if (result.ok) onImported(importMessage(result))
      else setError(result.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Gewichte einfügen" doneLabel="Abbrechen">
      <div className="px-screen-x flex min-h-0 flex-1 flex-col gap-2.5 pt-1 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <p className="text-label text-muted px-1 leading-normal">
          Kurzbefehl „Kcalm Gewichte“ ausführen, dann ins Feld tippen und „Einsetzen“ wählen.
        </p>
        <label className="bg-card rounded-field flex min-h-0 flex-1 flex-col px-3.5 py-3">
          <span className="sr-only">Text vom Kurzbefehl</span>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setError(null)
            }}
            placeholder={'kcalm-gewichte 1\n2026-10-22T07:12:00+02:00;74,8;kg'}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="text-body-large text-text placeholder:text-muted min-h-0 w-full flex-1 resize-none bg-transparent outline-none"
          />
        </label>
        {error && (
          <p role="alert" className="text-small text-danger px-1">
            {error}
          </p>
        )}
        <Button disabled={busy || text.trim() === ''} onClick={() => void submit()}>
          Übernehmen
        </Button>
      </div>
    </Sheet>
  )
}
