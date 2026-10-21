// Chips aus den Prototypen:
//  slot    Slot-Chips im Sheet: Höhe 34, aktiv Akzent-Fläche, sonst card (Kern)
//  portion Portions-Chips über dem Ziffernblock: Rahmen line (Kern)
//  filter  Filter Alle/Geprüft/…: Höhe 32, aktiv text als Fläche (Lebensmittel)
//  scale   Skalierung ×0,5 … ×2: Höhe 34, Radius 17, aktiv text als Fläche (Mahlzeit)
import type { ButtonHTMLAttributes } from 'react'

export type ChipVariant = 'slot' | 'portion' | 'filter' | 'scale'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ChipVariant; active?: boolean }

const base: Record<ChipVariant, string> = {
  slot: 'min-h-[34px] px-3.5 rounded-chip text-label font-medium whitespace-nowrap transition-colors duration-200',
  portion: 'min-h-[34px] px-3 rounded-chip border border-line bg-card text-secondary font-medium whitespace-nowrap',
  filter: 'min-h-8 px-3 rounded-button text-secondary font-medium whitespace-nowrap',
  scale: 'min-h-[34px] px-3.5 rounded-chip text-label font-semibold whitespace-nowrap',
}

function colors(variant: ChipVariant, active: boolean): string {
  if (variant === 'slot') return active ? 'bg-accent text-on-accent' : 'bg-card text-text'
  if (variant === 'filter' || variant === 'scale') return active ? 'bg-text text-bg' : 'bg-card text-text'
  return 'text-text'
}

export function Chip({ variant = 'slot', active = false, className = '', type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      aria-pressed={variant === 'portion' ? undefined : active}
      className={`press flex shrink-0 items-center ${base[variant]} ${colors(variant, active)} ${className}`}
      {...rest}
    />
  )
}
