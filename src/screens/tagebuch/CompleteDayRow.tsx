// „Tag vollständig getrackt“ als Schalter-Zeile unter dem letzten Slot (kein Prototyp, mit Jan abgestimmt).
// Grundlage für Verbrauchsschätzung und Monatsauswertung; im Kalender als Punkt sichtbar.
import { Card } from '../../components/ui/Card.tsx'
import { Switch } from '../../components/ui/Switch.tsx'

export function CompleteDayRow({ complete, onChange }: { complete: boolean; onChange: (complete: boolean) => void }) {
  return (
    <Card padded={false} className="flex min-h-[60px] items-center gap-2.5 px-4 py-2">
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-body">Tag vollständig getrackt</span>
        <span className="text-small text-muted">Zählt für Schätzung und Auswertung</span>
      </span>
      <Switch checked={complete} onChange={onChange} label="Tag vollständig getrackt" />
    </Card>
  )
}
