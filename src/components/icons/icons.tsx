// Linien-Icons aus den Prototypen (runde Enden, 1,8–2,2 px Strich).
// Immer aria-hidden; Knöpfe mit nur einem Icon tragen selbst ein aria-label.
import type { ReactNode, SVGProps } from 'react'

type IconProps = { size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, 'children'>

function Svg({ size = 22, strokeWidth = 1.8, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconDiary = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="3" width="16" height="18" rx="3" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </Svg>
)

export const IconStats = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
)

export const IconPlus = (p: IconProps) => (
  <Svg strokeWidth={2.2} size={24} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </Svg>
)

export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Svg>
)

export const IconCheck = (p: IconProps) => (
  <Svg strokeWidth={2.2} size={18} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Svg>
)

export const IconChevronRight = (p: IconProps) => (
  <Svg strokeWidth={2} size={16} {...p}>
    <path d="M9 18l6-6-6-6" />
  </Svg>
)

export const IconChevronDown = (p: IconProps) => (
  <Svg strokeWidth={2} size={16} {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
)

export const IconBack = (p: IconProps) => (
  <Svg strokeWidth={2} size={20} {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Svg>
)

/** Scan-Knopf neben dem Suchfeld (Kern.dc.html) */
export const IconBarcode = (p: IconProps) => (
  <Svg size={20} {...p}>
    <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M11 8v8M14 8v8M17 8v8" />
  </Svg>
)

/** Taschenlampe im Scanner (Scanner.dc.html) */
export const IconTorch = (p: IconProps) => (
  <Svg size={20} {...p}>
    <path d="M8 2h8l-1 5H9zM9 7h6l-1 13h-4z" />
    <path d="M12 11v3" />
  </Svg>
)

export const IconClose = (p: IconProps) => (
  <Svg strokeWidth={2} size={18} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)

export const IconInfo = (p: IconProps) => (
  <Svg strokeWidth={2} size={18} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16h.01" />
  </Svg>
)

export const IconChevronUp = (p: IconProps) => (
  <Svg strokeWidth={2} size={16} {...p}>
    <path d="M6 15l6-6 6 6" />
  </Svg>
)

export const IconTrash = (p: IconProps) => (
  <Svg strokeWidth={1.8} size={18} {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" />
  </Svg>
)

export const IconCalendar = (p: IconProps) => (
  <Svg size={18} {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Svg>
)

/** Tageswechsel in der Tagesleiste (18 px, Strich 1,8) */
export const IconArrowLeft = (p: IconProps) => (
  <Svg size={18} {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Svg>
)

export const IconArrowRight = (p: IconProps) => (
  <Svg size={18} {...p}>
    <path d="M9 18l6-6-6-6" />
  </Svg>
)
