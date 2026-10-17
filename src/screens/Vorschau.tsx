// Vorschauseite aller Bausteine aus Phase 0. Wird in Phase 11 im Build ausgeblendet.
// Beispielwerte sind nur zur Darstellung.
import { useState, type ReactNode } from 'react'
import { setThemePref, useThemePref, type ThemePref } from '../app/theme.ts'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Chip } from '../components/ui/Chip.tsx'
import { Keypad } from '../components/ui/Keypad.tsx'
import { ProgressBar } from '../components/ui/ProgressBar.tsx'
import { Ring } from '../components/ui/Ring.tsx'
import { Screen } from '../components/ui/Screen.tsx'
import { Segmented } from '../components/ui/Segmented.tsx'
import { Sheet } from '../components/ui/Sheet.tsx'
import { Switch } from '../components/ui/Switch.tsx'
import { useToast } from '../components/ui/toastContext.ts'
import { formatNumber } from '../logic/format.ts'
import { parseKeypadValue } from '../logic/keypad.ts'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-small text-muted px-1 pt-2.5 tracking-[0.6px] uppercase">{title}</h2>
      {children}
    </section>
  )
}

const typeScale = [
  ['text-hero', 'hero 44'],
  ['text-ring', 'ring 34'],
  ['text-title', 'title 26'],
  ['text-keypad', 'keypad 22'],
  ['text-unit', 'unit 20'],
  ['text-sheet-title', 'sheetTitle 17'],
  ['text-body-large', 'bodyLarge 16'],
  ['text-body', 'body 15'],
  ['text-label', 'label 14'],
  ['text-secondary', 'secondary 13'],
  ['text-small', 'small 12'],
  ['text-tiny', 'tiny 11'],
] as const

const themeOptions = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
] as const

const tabOptions = [
  { value: 'p', label: 'Produkte' },
  { value: 'm', label: 'Mahlzeiten' },
  { value: 'r', label: 'Rezepte' },
] as const

const slots = ['Frühstück', 'Mittag', 'Snacks', 'Abend']
const filters = ['Alle', 'Geprüft', 'Eigene', 'BLS']

const DAY_GOAL = 2675

export function Vorschau() {
  const toast = useToast()
  const theme = useThemePref()
  const [tab, setTab] = useState<'p' | 'm' | 'r'>('p')
  const [slot, setSlot] = useState('Abend')
  const [filter, setFilter] = useState('Alle')
  const [water, setWater] = useState(true)
  const [estimate, setEstimate] = useState(false)
  const [eaten, setEaten] = useState(1398)
  const [amount, setAmount] = useState('60')
  const [sheetOpen, setSheetOpen] = useState(false)

  const left = DAY_GOAL - eaten
  const amountNum = parseKeypadValue(amount) ?? 0

  return (
    <Screen title="Bausteine">
      <Section title="Darstellung">
        <Card>
          <Segmented
            label="Erscheinungsbild"
            inCard
            options={themeOptions}
            value={theme}
            onChange={(v: ThemePref) => setThemePref(v)}
          />
        </Card>
      </Section>

      <Section title="Schrift">
        <Card className="flex flex-col gap-1">
          {typeScale.map(([cls, name]) => (
            <div key={cls} className="flex items-baseline justify-between gap-3">
              <span className={cls}>1.273</span>
              <span className="text-small text-muted">{name}</span>
            </div>
          ))}
        </Card>
      </Section>

      <Section title="Karten">
        <Card summary>
          <span className="text-body">Übersichtskarte · Radius 24</span>
        </Card>
        <Card>
          <span className="text-body">Karte · Radius 18</span>
        </Card>
      </Section>

      <Section title="Knöpfe">
        <Button onClick={() => toast('Hauptknopf gedrückt')}>Zu Abend hinzufügen</Button>
        <Button disabled>Deaktiviert</Button>
        <div className="flex gap-2">
          <Button variant="danger">Löschen</Button>
          <Button variant="secondary" className="flex-1">
            Wie gestern
          </Button>
        </div>
        <Card className="flex items-center justify-between">
          <Button variant="small">Jetzt sichern</Button>
          <Button variant="text">Fertig</Button>
        </Card>
      </Section>

      <Section title="Chips">
        <div className="flex gap-1.5 overflow-x-auto">
          {slots.map((s) => (
            <Chip key={s} active={s === slot} onClick={() => setSlot(s)}>
              {s}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <Chip key={f} variant="filter" active={f === filter} onClick={() => setFilter(f)}>
              {f}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip variant="portion" onClick={() => setAmount('250')}>
            1 Becher · 250 g
          </Chip>
          <Chip variant="portion" onClick={() => setAmount('150')}>
            150 g
          </Chip>
        </div>
      </Section>

      <Section title="Segment-Umschalter">
        <Segmented label="Lebensmittel-Reiter" options={tabOptions} value={tab} onChange={setTab} />
      </Section>

      <Section title="Schalter">
        <Card padded={false}>
          <div className="flex min-h-[60px] items-center gap-2.5 px-4">
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-body">Wasser tracken</span>
              <span className="text-small text-muted">Ziel 2,5 l · Schnellgrößen 250 / 500 ml</span>
            </span>
            <Switch label="Wasser tracken" checked={water} onChange={setWater} />
          </div>
          <div className="border-line flex min-h-[60px] items-center gap-2.5 border-t px-4">
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-body">Verbrauchsschätzung</span>
              <span className="text-small text-muted">Gewicht per Kurzbefehl aus Apple Health</span>
            </span>
            <Switch label="Verbrauchsschätzung" checked={estimate} onChange={setEstimate} />
          </div>
        </Card>
      </Section>

      <Section title="Ring und Fortschritt">
        <Card summary className="flex flex-col gap-3">
          <div className="flex items-center gap-[18px]">
            <Ring
              progress={eaten / DAY_GOAL}
              value={Math.abs(left)}
              label={left < 0 ? 'kcal drüber' : 'kcal übrig'}
              over={left < 0}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-[9px]">
              {[
                ['Eiweiß', 96, 140],
                ['Kohlenhydrate', 176, 330],
                ['Fett', 15, 80],
                ['Ballaststoffe', 17, 30],
              ].map(([name, val, goal]) => (
                <div key={name} className="flex flex-col gap-1">
                  <div className="text-secondary flex justify-between">
                    <span className="text-muted">{name}</span>
                    <span className="font-semibold">
                      {val}
                      <span className="text-muted font-normal">/{goal} g</span>
                    </span>
                  </div>
                  <ProgressBar value={Number(val) / Number(goal)} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setEaten((e) => Math.max(0, e - 400))}>
              − 400 kcal
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setEaten((e) => e + 400)}>
              + 400 kcal
            </Button>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="text-label font-medium">Wasser</span>
          <ProgressBar value={1250 / 2500} height={4} tone="accent" />
          <span className="text-secondary text-muted whitespace-nowrap">1,25 / 2,5 l</span>
        </Card>
      </Section>

      <Section title="Ziffernblock">
        <div className="flex items-baseline justify-between px-1">
          <span className="text-hero">
            {amount || '0'}
            <span className="text-unit text-muted"> g</span>
          </span>
          <span className="text-unit font-semibold">
            {formatNumber((372 * amountNum) / 100)} <span className="text-label text-muted font-normal">kcal</span>
          </span>
        </div>
        <Keypad value={amount} onChange={setAmount} />
        <Button disabled={amountNum <= 0} onClick={() => toast(`Haferflocken · ${formatNumber((372 * amountNum) / 100)} kcal zu ${slot}`)}>
          Zu {slot} hinzufügen
        </Button>
      </Section>

      <Section title="Bottom-Sheet und Toast">
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          Sheet öffnen
        </Button>
        <Button variant="secondary" onClick={() => toast('250 ml Wasser hinzugefügt')}>
          Toast zeigen
        </Button>
      </Section>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Beispiel-Sheet">
        <div className="flex flex-none gap-1.5 overflow-x-auto px-4 pt-1 pb-2.5">
          {slots.map((s) => (
            <Chip key={s} active={s === slot} onClick={() => setSlot(s)}>
              {s}
            </Chip>
          ))}
        </div>
        <div className="scroll-area px-4 pb-6">
          <Card padded={false}>
            {Array.from({ length: 24 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toast(`Zeile ${i + 1} gewählt`)}
                className={`flex min-h-14 w-full items-center px-3.5 ${i ? 'border-line border-t' : ''}`}
              >
                <span className="text-body flex-1 font-medium">Zeile {i + 1}</span>
                <span className="text-secondary text-muted">{formatNumber(40 + i * 17)} kcal/100 g</span>
              </button>
            ))}
          </Card>
        </div>
      </Sheet>
    </Screen>
  )
}
