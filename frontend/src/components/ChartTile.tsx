import type { ReactNode } from 'react'

interface ChartTileProps {
  title: string
  description?: string
  // A small mono line above the title, e.g. "KARTENAUFGABE 1".
  label?: string
  // Closes the tile, below the description.
  footer?: ReactNode
  icon?: ReactNode
  // A small label in the tile's corner, e.g. "Demnächst verfügbar".
  badge?: string
  // The tall variant for the primary tiles on the start page.
  size?: 'md' | 'lg'
  className?: string
}

// The "chart tile" pattern from ADR-0014: an ink-bordered rectangle with a
// dog-eared corner fold, used in place of solid-color full-width action
// bars. First shared component built per that ADR's consequences.
export function ChartTile({
  title,
  description,
  label,
  footer,
  icon,
  badge,
  size = 'md',
  className = '',
}: ChartTileProps) {
  const large = size === 'lg'
  return (
    <div
      className={`relative rounded-tile border border-ink bg-surface ${large ? 'flex min-h-56 flex-col p-7' : 'p-5'} ${className}`}
    >
      <span
        aria-hidden
        className="absolute top-0 right-0 h-5 w-5 border-b border-l border-ink bg-bg"
        style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
      />
      {icon ? <div className={`mb-3 ${large ? 'text-primary' : 'text-ink'}`}>{icon}</div> : null}
      {label ? <span className="mb-1 font-mono text-xs tracking-wide text-ink-soft uppercase">{label}</span> : null}
      <h3 className={`font-serif text-ink ${large ? 'text-2xl' : 'text-lg'}`}>{title}</h3>
      {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
      {footer ? <div className="mt-3 text-sm text-ink-soft">{footer}</div> : null}
      {badge ? (
        <span className="mt-auto self-start bg-surface-alt px-2 py-1 pt-1 font-mono text-xs tracking-wide text-ink-soft uppercase">
          {badge}
        </span>
      ) : null}
    </div>
  )
}
