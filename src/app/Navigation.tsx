// Schwebende Pill-Navigation nach Kern.dc.html:
// links/rechts 20, unten 26, Höhe 62, Radius 31; aktiv = text, inaktiv = muted.
import type { ComponentType } from 'react'
import { IconDiary, IconPlus, IconSearch, IconSettings, IconStats } from '../components/icons/icons.tsx'
import { href, type Route } from './router.ts'

type Props = { current: Route; onAdd: () => void }

function NavLink({ to, label, Icon, current }: { to: Route; label: string; Icon: ComponentType; current: Route }) {
  const active = to === current
  return (
    <a
      href={href(to)}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`press flex size-12 items-center justify-center ${active ? 'text-text' : 'text-muted'}`}
    >
      <Icon />
    </a>
  )
}

export function Navigation({ current, onAdd }: Props) {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="left-nav-inset-x right-nav-inset-x bottom-nav-inset-bottom h-nav-height rounded-nav bg-nav shadow-nav absolute z-10 flex items-center justify-around px-2"
    >
      <NavLink to="tagebuch" label="Tagebuch" Icon={IconDiary} current={current} />
      <NavLink to="statistik" label="Statistik" Icon={IconStats} current={current} />
      <button
        type="button"
        aria-label="Hinzufügen"
        onClick={onAdd}
        className="press bg-accent text-on-accent flex h-[46px] w-16 items-center justify-center rounded-full"
      >
        <IconPlus />
      </button>
      <NavLink to="lebensmittel" label="Lebensmittel" Icon={IconSearch} current={current} />
      <NavLink to="einstellungen" label="Einstellungen" Icon={IconSettings} current={current} />
    </nav>
  )
}
