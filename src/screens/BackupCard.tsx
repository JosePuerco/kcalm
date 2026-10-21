// Gruppe „Daten“ in den Einstellungen nach Einstellungen.dc.html: Backup-Zeile mit „Jetzt sichern“
// und „Backup importieren“ (Import-Sheet in BackupImport.tsx).
import { useState } from 'react'
import { shareOrDownload } from '../app/share.ts'
import { IconChevronRight } from '../components/icons/icons.tsx'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { useToast } from '../components/ui/toastContext.ts'
import { createBackup, getLastBackupAt, markBackedUp } from '../db/backup.ts'
import { useLiveQuery } from '../db/live.ts'
import { backupFileName, backupStatus, serializeBackup } from '../logic/backup.ts'
import { useBackupImport } from './useBackupImport.tsx'

export function BackupCard() {
  const toast = useToast()
  const lastBackupAt = useLiveQuery(getLastBackupAt, [])
  const [saving, setSaving] = useState(false)
  const backupImport = useBackupImport()

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

  return (
    <Card padded={false}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-body">Backup</span>
          {/* Platz halten, damit die Zeile beim Laden nicht springt */}
          <span className={`text-small ${status?.warn ? 'text-warn-text' : 'text-muted'}`}>{status?.text ?? ' '}</span>
        </span>
        <Button variant="small" disabled={saving} onClick={() => void backupNow()}>
          Jetzt sichern
        </Button>
      </div>
      <button
        type="button"
        className="border-line text-text flex min-h-[52px] w-full items-center gap-2.5 border-t pr-3 pl-4 text-left"
        onClick={backupImport.pick}
      >
        <span className="text-body flex-1">Backup importieren</span>
        <IconChevronRight className="text-chevron-muted" />
      </button>
      {backupImport.element}
    </Card>
  )
}
