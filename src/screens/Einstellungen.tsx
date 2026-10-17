import { href } from '../app/router.ts'
import { IconChevronRight } from '../components/icons/icons.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Screen } from '../components/ui/Screen.tsx'

// Gruppen (Ziele, Funktionen, Daten, Darstellung, Über) kommen in späteren Phasen.
// Bis Phase 11: Zugang zur Bausteine-Vorschau (in der PWA gibt es keine Adresszeile).
export function Einstellungen() {
  return (
    <Screen title="Einstellungen">
      <Card padded={false}>
        <a href={href('vorschau')} className="text-text flex min-h-[52px] items-center gap-2.5 pr-3 pl-4">
          <span className="text-body flex-1">Bausteine (Vorschau)</span>
          <IconChevronRight className="text-chevron-muted" />
        </a>
      </Card>
    </Screen>
  )
}
