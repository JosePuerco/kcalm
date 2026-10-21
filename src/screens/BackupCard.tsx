// Gruppe „Daten“ in den Einstellungen nach Einstellungen.dc.html: Backup-Zeile mit „Jetzt sichern“
// und „Backup importieren“. Das Import-Sheet ist eigenes Design (kein Prototyp), mit Jan abgestimmt.
import { useRef, useState, type ReactNode } from 'react'
import { reloadThemePref } from '../app/theme.ts'
import { shareOrDownload } from '../app/share.ts'
import { IconChevronRight } from '../components/icons/icons.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Sheet } from '../components/ui/Sheet.tsx'
import { useToast } from '../components/ui/toastContext.ts'
import { createBackup, getLastBackupAt, markBackedUp, mergeBackup, replaceWithBackup } from '../db/backup.ts'
import { useLiveQuery } from '../db/live.ts'
import { backupFileName, backupStatus, backupSummary, parseBackup, serializeBackup, type ParseResult } from '../logic/backup.ts'
import { formatDateTime, formatNumber } from '../logic/format.ts'

export function BackupCard() {
  const toast = useToast()
  const lastBackupAt = useLiveQuery(getLastBackupAt, [])
  const [saving, setSaving] = useState(false)
  const [picked, setPicked] = useState<ParseResult | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const status = lastBackupAt === undefined ? null : backupStatus(lastBackupAt)

  const backupNow = async () => {
    setSaving(true)
    try {
      const now = new Date()
      const json = serializeBackup(await createBackup(now))
      const file = new File([json], backupFileName(now), { type: 'application/json' })
      const outcome = await shareOrDownload(file)
      if (outcome !== 'cancelled') await markBackedUp(now)
    } catch (error) {
      console.error(error)
      toast('Sichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setPicked(parseBackup(await file.text()))
    } catch (error) {
      console.error(error)
      setPicked({ ok: false, error: 'Datei nicht lesbar' })
    }
  }

  return (
    <Card padded={false}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-body">Backup</span>
          {/* Platz halten, damit die Zeile beim Laden nicht springt */}
          <span className={`text-small ${status?.warn ? 'text-warn-text' : 'text-muted'}`}>{status?.text ?? ' '}</span>
        </span>
        <Button variant="small" disabled={saving} onClick={() => void backupNow()}>
          Jetzt sichern
        </Button>
      </div>
      <button
        type="button"
        className="border-line text-text flex min-h-[52px] w-full items-center gap-2.5 border-t pr-3 pl-4 text-left"
        onClick={() => fileInput.current?.click()}
      >
        <span className="text-body flex-1">Backup importieren</span>
        <IconChevronRight className="text-chevron-muted" />
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          void pickFile(e.target.files?.[0])
          // Gleiche Datei soll erneut wählbar sein
          e.target.value = ''
        }}
      />
      <Sheet open={picked !== null} onClose={() => setPicked(null)} title="Backup importieren" doneLabel="Abbrechen">
        {picked && (
          <ImportSheetBody
            result={picked}
            onPickOther={() => fileInput.current?.click()}
            onDone={(message) => {
              setPicked(null)
              toast(message)
            }}
          />
        )}
      </Sheet>
    </Card>
  )
}

type BodyProps = {
  result: ParseResult
  onPickOther: () => void
  onDone: (message: string) => void
}

function ImportSheetBody({ result, onPickOther, onDone }: BodyProps) {
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
