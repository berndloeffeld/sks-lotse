interface LogoMarkProps {
  className?: string
}

// The brand mark: a chart tile (see ChartTile's dog-eared corner, ADR-0014)
// with a plotted course line and position fix — "Lotse" (pilot) charting a
// course, and a nod to the Lot gauge's dot-advances-on-progress motif.
export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <path
        d="M6 6H43L58 21V58H6Z"
        fill="var(--color-surface)"
        stroke="var(--color-ink)"
        strokeWidth={3}
        strokeLinejoin="miter"
      />
      <path d="M18 44L40 20" stroke="var(--color-ink)" strokeWidth={3} strokeLinecap="round" />
      <rect x={15.5} y={41.5} width={5} height={5} fill="var(--color-ink)" />
      <circle cx={40} cy={20} r={5} fill="var(--color-primary)" />
    </svg>
  )
}

interface LogoProps {
  className?: string
  // Light wordmark for dark bands (the landing page's header).
  inverted?: boolean
}

export function Logo({ className, inverted = false }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <LogoMark className="h-8 w-8 shrink-0" />
      <span className={`font-serif text-xl ${inverted ? 'text-surface' : 'text-ink'}`}>SKS Lotse</span>
    </span>
  )
}
