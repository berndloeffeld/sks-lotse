interface IconProps {
  className?: string
}

const shared = {
  viewBox: '0 0 32 32',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

// A folded-corner page — echoes the ChartTile dog-ear (ADR-0014) — standing
// in for a question pulled from the official catalog.
export function CatalogIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true" focusable="false">
      <path d="M8 4h12l4 4v20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M20 4v4h4" />
      <path d="M11 16h10M11 20h10M11 24h6" />
    </svg>
  )
}

// A speech bubble with a waveform — typing or speaking the answer both lead
// here.
export function AnswerIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true" focusable="false">
      <path d="M6 8h20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H14l-6 5v-5H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z" />
      <path d="M10 15v2M14 13v6M18 12v8M22 15v2" />
    </svg>
  )
}

// The logomark's course-line-and-fix-dot motif, reused at feature-icon
// scale for "you get graded feedback".
export function FeedbackIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true" focusable="false">
      <path d="M8 22 22 8" />
      <rect x="6.5" y="20.5" width="3" height="3" fill="currentColor" stroke="none" />
      <circle cx="22" cy="8" r="3" fill="var(--color-primary)" stroke="none" />
    </svg>
  )
}

// A pennant on a pole — "Frage melden", small enough for a toolbar button.
export function FlagIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true" focusable="false">
      <path d="M8 28V5" />
      <path d="M8 6h15l-3.5 5 3.5 5H8" />
    </svg>
  )
}

// A compass rose in a ring — the Lotsen-Check (AI answer check) button.
export function CompassIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="12" />
      <path d="m20.5 11.5-3 6-6 3 3-6 6-3Z" />
    </svg>
  )
}
