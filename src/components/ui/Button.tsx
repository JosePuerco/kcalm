// Knöpfe aus den Prototypen. Alle mit Press-Effekt scale(.95).
//  primary   Hauptknopf: Höhe 54, Radius 16, Akzent-Fläche, 17/600
//  secondary Karte als Fläche, gleiche Größe (z. B. „Wie gestern“)
//  danger    „Löschen“ im Sheet: Karte als Fläche, danger-Text, 16/600
//  small     „Jetzt sichern“: Höhe 40, Radius 12, Akzent-Fläche, 14/600
//  text      „Fertig“: nur Text in accentText, 16/600, Touch-Ziel 44
import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'small' | 'text'

const variants: Record<ButtonVariant, string> = {
  primary: 'min-h-[54px] rounded-button bg-accent text-on-accent text-sheet-title px-[18px] justify-center',
  secondary: 'min-h-[54px] rounded-button bg-card text-text text-body-large font-semibold px-[18px] justify-center',
  danger: 'min-h-[54px] rounded-button bg-card text-danger text-body-large font-semibold px-[18px] justify-center',
  small: 'min-h-10 rounded-tile bg-accent text-on-accent text-label font-semibold px-3.5 justify-center',
  text: 'min-h-touch-min text-accent-text text-body-large font-semibold px-2.5',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }

export function Button({ variant = 'primary', className = '', type = 'button', disabled, ...rest }: Props) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`press flex items-center text-center disabled:opacity-40 ${variants[variant]} ${className}`}
      {...rest}
    />
  )
}
