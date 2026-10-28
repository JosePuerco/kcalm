// Anleitung „Kamera dauerhaft erlauben“ in der App (Einstellungen › Hilfe). Gekürzte Fassung von
// docs/kamera-erlaubnis.md; bei Änderungen beide anpassen. Begriffe nach iOS 27.2.
import type { ReactNode } from 'react'
import { Card } from '../../components/ui/Card.tsx'
import { Sheet } from '../../components/ui/Sheet.tsx'

const setupSteps: ReactNode[] = [
  <>
    In Safari <Code>josepuerco.github.io/kcalm</Code> öffnen.
  </>,
  <>
    Links neben der Adressleiste auf das <B>Seitenmenü</B> (drei Striche) tippen, nach unten scrollen zu{' '}
    <B>Website-Einstellungen</B>.
  </>,
  <>
    <B>Kamera</B> auf <B>Erlauben</B> stellen.
  </>,
  <>
    Erst jetzt: <B>Seitenmenü</B> → <B>Teilen</B> → <B>Zum Home-Bildschirm</B>, <B>Als Web-App öffnen</B> eingeschaltet
    lassen → <B>Hinzufügen</B>.
  </>,
]

const reinstallSteps: ReactNode[] = [
  <>
    Hier unter <B>Daten</B> → <B>Backup</B> → <B>Jetzt sichern</B>, z.&nbsp;B. in Dateien.
  </>,
  <>Kcalm vom Home-Bildschirm löschen.</>,
  <>Die vier Schritte oben.</>,
  <>
    Neue App öffnen → <B>Aus Backup laden</B>.
  </>,
]

export function CameraGuideSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Kamera dauerhaft erlauben">
      <div className="scroll-area px-screen-x flex flex-col gap-2.5 pt-1 pb-[calc(24px+env(safe-area-inset-bottom))]">
        <p className="text-label text-muted px-1 leading-normal">
          Sonst fragt iOS nach jedem Start der App, ob Kcalm die Kamera nutzen darf. Die App übernimmt die
          Kamera-Einstellung aus Safari nur in dem Moment, in dem du sie zum Home-Bildschirm hinzufügst. Deshalb zählt die
          Reihenfolge.
        </p>
        <Card className="text-label leading-normal">
          <p className="font-semibold">Neu einrichten</p>
          <Steps steps={setupSteps} />
        </Card>
        <Card className="text-label leading-normal">
          <p className="font-semibold">Kcalm ist schon auf dem Home-Bildschirm</p>
          <p className="mt-1">
            Die Einstellung später in Safari zu ändern, wirkt nicht auf die installierte App. Du musst sie neu hinzufügen.
          </p>
          <p className="text-warn-text mt-2 font-medium">
            Beim Löschen vom Home-Bildschirm löscht iOS auch alle Daten von Kcalm. Erst sichern!
          </p>
          <Steps steps={reinstallSteps} />
        </Card>
        <p className="text-small text-muted px-1 leading-[1.45]">
          Fehlt „Zum Home-Bildschirm“ beim Teilen: ganz unten <B>Aktionen bearbeiten</B>. Für alle Websites auf einmal geht
          es auch unter iPhone-Einstellungen › Apps › Safari › Kamera › Erlauben.
        </p>
      </div>
    </Sheet>
  )
}

function Steps({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5">
      {steps.map((step, i) => (
        <li key={i}>{step}</li>
      ))}
    </ol>
  )
}

function Code({ children }: { children: ReactNode }) {
  return <code className="bg-bg rounded-small-button px-1.5 py-0.5">{children}</code>
}

/** Hervorhebung in 600 (Geist hat nur 400/500/600) */
function B({ children }: { children: ReactNode }) {
  return <span className="font-semibold">{children}</span>
}
