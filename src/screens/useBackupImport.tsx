// Backup importieren: Dateiauswahl + Import-Sheet (eigenes Design, mit Jan abgestimmt).
// Genutzt in den Einstellungen (Gruppe „Daten“) und im Willkommensbildschirm der Ersteinrichtung.
import { useRef, useState, type ReactNode } from 'react'
import { Sheet } from '../components/ui/Sheet.tsx'
import { useToast } from '../components/ui/toastContext.ts'
import { parseBackup, type ParseResult } from '../logic/backup.ts'
import { ImportSheetBody } from './ImportSheetBody.tsx'

/** pick() öffnet die Dateiauswahl; element gehört einmal in den Baum (Eingabe + Sheet) */
export function useBackupImport(): { pick: () => void; element: ReactNode } {
  const toast = useToast()
  const [picked, setPicked] = useState<ParseResult | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const pick = () => fileInput.current?.click()

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setPicked(parseBackup(await file.text()))
    } catch (error) {
      console.error(error)
      setPicked({ ok: false, error: 'Datei nicht lesbar' })
    }
  }

  const element = (
    <>
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
            onPickOther={pick}
            onDone={(message) => {
              setPicked(null)
              toast(message)
            }}
          />
        )}
      </Sheet>
    </>
  )
  return { pick, element }
}
