// Anleitung „Kurzbefehl einrichten“ in der App. Gekürzte Fassung von docs/kurzbefehl-gewichte.md;
// bei Änderungen beide anpassen.
import type { ReactNode } from 'react'
import { Card } from '../../../components/ui/Card.tsx'
import { Sheet } from '../../../components/ui/Sheet.tsx'

const steps: ReactNode[] = [
  <>
    <B>Health-Proben suchen</B>: Typ <B>Gewicht</B>, Filter <B>Startdatum liegt in den letzten 60 Tagen</B>, sortiert nach
    Startdatum, <B>Älteste zuerst</B>, ohne Limit.
  </>,
  <>
    <B>Mit jedem wiederholen</B> für die gefundenen Proben.
  </>,
  <>
    Darin <B>Text</B>: <Code>Startdatum;Wert;Einheit</Code>. Dazu dreimal die Variable <B>Wiederholungsobjekt</B> einfügen
    und <B>Startdatum</B>, <B>Wert</B> bzw. <B>Einheit</B> wählen. Beim Startdatum <B>Datumsformat ISO 8601</B> mit Uhrzeit
    einstellen.
  </>,
  <>
    Nach der Wiederholung <B>Text kombinieren</B>: Wiederholungsergebnisse, mit <B>neuen Zeilen</B>.
  </>,
  <>
    <B>Text</B> mit zwei Zeilen: <Code>kcalm-gewichte 1</Code>, darunter die Variable <B>Kombinierter Text</B>.
  </>,
  <>
    <B>In Zwischenablage kopieren</B>.
  </>,
]

function Code({ children }: { children: ReactNode }) {
  return <code className="bg-bg rounded-small-button px-1.5 py-0.5">{children}</code>
}

export function GuideSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Kurzbefehl einrichten">
      <div className="scroll-area px-screen-x flex flex-col gap-2.5 pt-1 pb-[calc(24px+env(safe-area-inset-bottom))]">
        <p className="text-label text-muted px-1 leading-normal">
          Der Kurzbefehl liest deine Gewichte der letzten 60 Tage aus Apple Health und kopiert sie in die
          Zwischenablage. Kcalm selbst hat keinen Zugriff auf Health.
        </p>
        <Card className="text-label leading-normal">
          <p>
            App <B>Kurzbefehle</B> → <B>+</B> → Name <B>Kcalm Gewichte</B>. Diese Aktionen der Reihe nach hinzufügen:
          </p>
          <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5">
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </Card>
        <Card className="text-label leading-normal">
          Beim ersten Ausführen fragt iOS, ob der Kurzbefehl Gewichte aus Health lesen darf: <B>Erlauben</B>. Danach den
          Kurzbefehl ausführen, hierher wechseln und <B>Gewichte einfügen</B> tippen. Bekannte Werte werden nicht doppelt
          gespeichert; mehrere Messungen an einem Tag: die erste zählt.
        </Card>
        <p className="text-small text-muted px-1 leading-[1.45]">
          Meldet Kcalm „Zeile … ist nicht lesbar“, stimmt meist das Datumsformat in Schritt 3 nicht: Es muss ISO 8601 sein.
        </p>
      </div>
    </Sheet>
  )
}

/** Hervorhebung in 600 (Geist hat nur 400/500/600) */
function B({ children }: { children: ReactNode }) {
  return <span className="font-semibold">{children}</span>
}
