import { ProgressPie, type ProgressSlice } from './ProgressPie'

interface ProgressSummaryTileProps {
  learned: number
  total: number
  slices?: ProgressSlice[]
}

// Aggregate "wie weit bin ich insgesamt" stat, across every topic — sits
// above the per-topic Lernstand list. Reuses the ink-bordered, dog-eared
// chart-tile motif from ADR-0014 for visual consistency, but stays a
// separate component: ChartTile's contract is a nav tile (title/description
// linking somewhere), this is a stat display with nowhere to link to.
export function ProgressSummaryTile({ learned, total, slices }: ProgressSummaryTileProps) {
  const percent = total > 0 ? Math.round((learned / total) * 100) : 0

  return (
    <div className="relative rounded-tile border border-ink bg-surface p-6">
      <span
        aria-hidden
        className="absolute top-0 right-0 h-5 w-5 border-b border-l border-ink bg-bg"
        style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
      />
      {/* Stacked (narrow): stats, bar, pie. From sm up the pie moves beside the
          stats and the bar spans the full width underneath both. */}
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0 sm:col-start-1 sm:row-start-1">
          <p className="font-mono text-xs tracking-wide text-ink-soft uppercase">Gesamtfortschritt</p>
          <p className="mt-2 font-serif text-4xl text-ink">{percent}%</p>
          <p className="mt-1 font-mono text-sm text-ink-soft">
            {learned} von {total} Fragen gelernt
          </p>
        </div>
        <div className="h-2 w-full bg-surface-alt sm:col-span-2 sm:row-start-2">
          <div className="h-full bg-success" style={{ width: `${percent}%` }} />
        </div>
        {slices && slices.length > 0 ? (
          <div className="sm:col-start-2 sm:row-start-1">
            <ProgressPie slices={slices} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
