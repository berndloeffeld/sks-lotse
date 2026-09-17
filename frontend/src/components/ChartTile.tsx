interface ChartTileProps {
  title: string
  description?: string
}

// The "chart tile" pattern from ADR-0014: an ink-bordered rectangle with a
// dog-eared corner fold, used in place of solid-color full-width action
// bars. First shared component built per that ADR's consequences.
export function ChartTile({ title, description }: ChartTileProps) {
  return (
    <div className="relative rounded-tile border border-ink bg-surface p-5">
      <span
        aria-hidden
        className="absolute top-0 right-0 h-5 w-5 border-b border-l border-ink bg-bg"
        style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
      />
      <h3 className="font-serif text-lg text-ink">{title}</h3>
      {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
    </div>
  )
}
