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

// An envelope with a warning triangle at its corner — "Fehler melden" (mail + problem). The
// triangle is cut out of the envelope with a mask, so it reads on any background.
export function ReportIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true" focusable="false">
      <mask id="report-icon-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
        <rect width="32" height="32" fill="white" />
        <path d="M23 12.5 32 29H14Z" fill="black" stroke="black" strokeWidth={3} />
      </mask>
      <g mask="url(#report-icon-cut)">
        <rect x="2.5" y="6.5" width="23" height="17" rx="2" />
        <path d="m3 8 11 8.5L25 8" />
      </g>
      <path d="M23 15.5 29.5 27.5h-13Z" />
      <path d="M23 20v3.5" />
      <circle cx="23" cy="26" r="0.6" fill="currentColor" />
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

// A certificate with a ribbon seal — the SBF See prerequisite/licence itself.
export function CertificateIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true" focusable="false">
      <rect x="4" y="6" width="24" height="16" rx="1" />
      <path d="M8 11h16M8 15h10" />
      <circle cx="12" cy="23" r="4" />
      <path d="m9.5 26.5-1.5 5 4-2 4 2-1.5-5" />
    </svg>
  )
}

// A chart corner under a pair of dividers — the Karten- und Gezeitenaufgabe.
export function ChartDividersIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true" focusable="false">
      <path d="M4 6h24v20H4z" />
      <path d="M4 12h24M10 6v6M10 26l4-9M18 6l-4 11" />
      <path d="M13 15 25 4M25 4l-5 1M25 4l-1 5" />
    </svg>
  )
}

// A sailboat over a wave line — the practical exam, and chartering a yacht.
export function BoatIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true" focusable="false">
      <path d="M16 5v14" />
      <path d="M16 6l7 11H16Z" />
      <path d="M13 19H8l-1 2 2-2h18l2 2-1-2h-4" />
      <path d="M4 26q3-3 6 0t6 0 6 0 6 0" />
    </svg>
  )
}
