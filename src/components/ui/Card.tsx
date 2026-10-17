// Karte: card-Fläche, Radius 18 (Übersicht 24), kein Schatten.
import type { HTMLAttributes } from 'react'

type Props = HTMLAttributes<HTMLDivElement> & {
  /** Übersichtskarte mit Radius 24 */
  summary?: boolean
  /** Innenabstand 16 (cardPadding); aus für Listenkarten */
  padded?: boolean
}

export function Card({ summary = false, padded = true, className = '', ...rest }: Props) {
  return (
    <div
      className={`bg-card ${summary ? 'rounded-summary-card' : 'rounded-card'} ${padded ? 'p-card-padding' : 'overflow-hidden'} ${className}`}
      {...rest}
    />
  )
}
