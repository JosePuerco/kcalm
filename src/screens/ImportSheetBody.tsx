// Import-Sheet für ein gewähltes Backup (eigenes Design, mit Jan abgestimmt).
import { useState, type ReactNode } from 'react'
import { reloadThemePref } from '../app/theme.ts'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { mergeBackup, replaceWithBackup } from '../db/backup.ts'
import { backupSummary, type ParseResult } from '../logic/backup.ts'
import { formatDateTime, formatNumber } from '../logic/format.ts'

type BodyProps = {
  result: ParseResult
  onPickOther: () => void
  onDone: (message: string) => void
}

export function ImportSheetBody({ result, onPickOther, onDone }: BodyProps) {
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!result.ok) {
    return (
      <SheetBody>
        <Card className="flex flex-col gap-1">
          <span className="text-body font-semibold">Import nicht möglich</span>
          <span className="text-label text-danger">{result.error}</span>
        </Card>
        <Button className="w-full" onClick={onPickOther}>
          Andere Datei wählen
        </Button>
      </SheetBody>
    )
  }

  const { backup } = result
  const summary = backupSummary(backup)

  const run = async (action: () => Promise<string>) => {
    setBusy(true)
    setFailed(false)
    try {
      const message = await action()
      await reloadThemePref()
      onDone(message)
    } catch (error) {
      console.error(error)
      setFailed(true)
      setBusy(false)
    }
  }

  const merge = () =>
    run(async () => {
      const { added, updated } = await mergeBackup(backup)
      if (added + updated === 0) return 'Nichts Neues im Backup'
      return `Importiert: ${formatNumber(added)} neu, ${formatNumber(updated)} aktualisiert`
    })

  const replace = () =>
    run(async () => {
      await replaceWithBackup(backup)
      return 'Backup eingespielt'
    })

  return (
    <SheetBody>
      <Card className="flex flex-col gap-1">
        <span className="text-body font-semibold">Backup vom {formatDateTime(new Date(backup.exportedAt))}</span>
        <span className="text-label text-muted">
          {formatNumber(summary.entries)} {summary.entries === 1 ? 'Eintrag' : 'Einträge'} ·{' '}
          {formatNumber(summary.products)} {summary.products === 1 ? 'Produkt' : 'Produkte'}
        </span>
      </Card>

      {confirmReplace ? (
        <>
          <p className="text-label text-muted px-1">
            Alle Daten auf diesem Gerät werden durch das Backup ersetzt. Das lässt sich nicht rückgängig machen.
          </p>
          <Button variant="danger" className="w-full" disabled={busy} onClick={() => void replace()}>
            Alles ersetzen
          </Button>
          <Button variant="secondary" className="w-full" disabled={busy} onClick={() => setConfirmReplace(false)}>
            Zurück
          </Button>
        </>
      ) : (
        <>
          <p className="text-label text-muted px-1">
            Zusammenführen behält deine Daten und übernimmt neuere Stände aus dem Backup. Ersetzen löscht alle Daten
            auf diesem Gerät und spielt das Backup ein.
          </p>
          <Button className="w-full" disabled={busy} onClick={() => void merge()}>
            Zusammenführen
          </Button>
          <Button variant="danger" className="w-full" disabled={busy} onClick={() => setConfirmReplace(true)}>
            Ersetzen
          </Button>
        </>
      )}

      {failed && <p className="text-label text-danger px-1">Import fehlgeschlagen, deine Daten sind unverändert.</p>}
    </SheetBody>
  )
}

function SheetBody({ children }: { children: ReactNode }) {
  return (
    <div className="scroll-area px-screen-x gap-card-gap flex flex-col pt-2 pb-[calc(16px+env(safe-area-inset-bottom))]">
      {children}
    </div>
  )
}
