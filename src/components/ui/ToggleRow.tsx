// Zeile mit Text, Untertitel und Schalter (Einstellungen.dc.html „Funktionen“, Ersteinrichtung Schritt 3).
// children stehen vor dem Schalter, z. B. der Link „Details“.
import type { ReactNode } from 'react'
import { Switch } from './Switch.tsx'

type Props = {
  label: string
  sub: string
  checked: boolean
  onChange: (checked: boolean) => void
  children?: ReactNode
}

export function ToggleRow({ label, sub, checked, onChange, children }: Props) {
  return (
    <div className="flex min-h-[60px] items-center gap-2.5 px-4 py-2">
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-body">{label}</span>
        <span className="text-small text-muted">{sub}</span>
      </span>
      {children}
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}
