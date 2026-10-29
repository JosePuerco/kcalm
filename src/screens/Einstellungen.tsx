import { useState, type ReactNode } from 'react'
import { version } from '../../package.json'
import { href, useSubPath } from '../app/router.ts'
import { THEME_OPTIONS, setThemePref, useThemePref } from '../app/theme.ts'
import { IconChevronRight } from '../components/icons/icons.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Screen } from '../components/ui/Screen.tsx'
import { Segmented } from '../components/ui/Segmented.tsx'
import { ToggleRow } from '../components/ui/ToggleRow.tsx'
import { getCostsEnabled, setCostsEnabled } from '../db/costs.ts'
import { getEstimateEnabled, setEstimateEnabled } from '../db/weights.ts'
import { useLiveQuery } from '../db/live.ts'
import { getSlots } from '../db/slots.ts'
import { formatNumber } from '../logic/format.ts'
import { BackupCard } from './BackupCard.tsx'
import { CameraGuideSheet } from './einstellungen/CameraGuideSheet.tsx'
import { EstimateScreen } from './einstellungen/EstimateScreen.tsx'
import { ExportScreen } from './einstellungen/ExportScreen.tsx'
import { ProfilesScreen } from './einstellungen/ProfilesScreen.tsx'
import { SlotsScreen } from './einstellungen/SlotsScreen.tsx'
import { useToday } from '../app/diaryState.ts'
import { loadProfiles } from '../db/profiles.ts'
import { profileStatus } from '../logic/profiles.ts'

// Einstellungen und Unterseiten über den Hash-Pfad
//  #/einstellungen          Übersicht
//  #/einstellungen/profile  Profile und Ziele
//  #/einstellungen/slots    Mahlzeiten-Slots
//  #/einstellungen/schaetzung  Verbrauchsschätzung
//  #/einstellungen/export   Export
export function Einstellungen() {
  const [view] = useSubPath()
  if (view === 'slots') return <SlotsScreen />
  if (view === 'profile') return <ProfilesScreen />
  if (view === 'schaetzung') return <EstimateScreen />
  if (view === 'export') return <ExportScreen />
  return <Overview />
}

// Gruppen nach Einstellungen.dc.html: Ziele, Funktionen, Daten, Darstellung, Über; dazu „Hilfe“ (nicht im Prototyp)
function Overview() {
  const slots = useLiveQuery(getSlots, [])
  const today = useToday()
  const profiles = useLiveQuery(loadProfiles, [])
  const estimate = useLiveQuery(getEstimateEnabled, [])
  const costs = useLiveQuery(getCostsEnabled, [])
  const theme = useThemePref()
  const [cameraGuide, setCameraGuide] = useState(false)
  const activeId = profiles && profileStatus(profiles.assignments, profiles.versions, today).activeProfileId
  const activeName = profiles?.profiles.find((p) => p.id === activeId)?.name ?? ''
  const slotsMeta = slots
    ? `${formatNumber(slots.length)}${slots.some((s) => s.timeFrom) ? ' · mit Uhrzeiten' : ''}`
    : ''

  return (
    <Screen title="Einstellungen">
      <Group title="Ziele">
        <Card padded={false}>
          <LinkRow to={href('einstellungen', 'profile')} label="Profile und Ziele" meta={activeName} />
          <LinkRow to={href('einstellungen', 'slots')} label="Mahlzeiten-Slots" meta={slotsMeta} border />
        </Card>
      </Group>
      <Group title="Funktionen">
        <Card padded={false}>
          <ToggleRow
            label="Verbrauchsschätzung"
            sub="Gewicht per Kurzbefehl aus Apple Health"
            checked={estimate === true}
            onChange={(on) => {
              setEstimateEnabled(on).catch((error: unknown) => console.error('Einstellung nicht gespeichert', error))
            }}
          >
            {estimate && (
              <a
                href={href('einstellungen', 'schaetzung')}
                className="text-secondary text-accent-text min-h-touch-min flex items-center px-1"
              >
                Details
              </a>
            )}
          </ToggleRow>
          <div className="border-line border-t">
            <ToggleRow
              label="Kostenauswertung"
              sub="Preise bei Lebensmitteln, Kosten in der Statistik"
              checked={costs === true}
              onChange={(on) => {
                setCostsEnabled(on).catch((error: unknown) => console.error('Einstellung nicht gespeichert', error))
              }}
            />
          </div>
        </Card>
      </Group>
      <Group title="Daten">
        <BackupCard />
      </Group>
      <Group title="Darstellung">
        <Card padded={false} className="px-card-padding py-3">
          <Segmented label="Erscheinungsbild" inCard options={THEME_OPTIONS} value={theme} onChange={setThemePref} />
        </Card>
      </Group>
      <Group title="Hilfe">
        <Card padded={false}>
          <button
            type="button"
            onClick={() => setCameraGuide(true)}
            className="text-text flex min-h-[52px] w-full items-center gap-2.5 pr-3 pl-4 text-left"
          >
            <span className="text-body flex-1">Kamera dauerhaft erlauben</span>
            <IconChevronRight className="text-chevron-muted" />
          </button>
        </Card>
      </Group>
      <Group title="Über">
        {/* Version aus package.json (beim Build eingesetzt); Quellenhinweise für OFF (ODbL) und BLS */}
        <Card padded={false} className="px-card-padding text-secondary text-muted flex flex-col gap-2 py-3.5 leading-[1.45]">
          <span>
            <span className="text-text font-semibold">Kcalm</span> · Version {version} · alle Daten bleiben auf diesem Gerät
          </span>
          <span>Produktdaten: Open Food Facts, Lizenz ODbL</span>
          <span>Grundlebensmittel: Max Rubner-Institut (2025), Bundeslebensmittelschlüssel 4.0</span>
        </Card>
      </Group>
      {/* Bausteine-Vorschau nur im Entwicklungsmodus; im Build fällt der Link weg */}
      {import.meta.env.DEV && (
        <Card padded={false}>
          <LinkRow to={href('vorschau')} label="Bausteine (Vorschau)" />
        </Card>
      )}
      <CameraGuideSheet open={cameraGuide} onClose={() => setCameraGuide(false)} />
    </Screen>
  )
}

function LinkRow({ to, label, meta, border }: { to: string; label: string; meta?: string; border?: boolean }) {
  return (
    <a
      href={to}
      className={`text-text flex min-h-[52px] items-center gap-2.5 pr-3 pl-4 ${border ? 'border-line border-t' : ''}`}
    >
      <span className="text-body flex-1">{label}</span>
      {meta && <span className="text-label text-muted">{meta}</span>}
      <IconChevronRight className="text-chevron-muted" />
    </a>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-small text-muted px-1 pt-2.5 tracking-[0.6px] uppercase">{title}</h2>
      {children}
    </section>
  )
}
