import { barHeight, formatDay, seriesMax, seriesSum, stackTotals } from '../dailyBars'

export interface BarSeries {
  name: string
  values: readonly number[]
  // A Tailwind fill class, e.g. 'fill-primary'.
  fill: string
}

interface DailyBarsProps {
  title: string
  // One ISO day per value, oldest first.
  days: readonly string[]
  // One series, or several stacked bottom-up in this order.
  series: readonly BarSeries[]
  format?: (value: number) => string
}

const HEIGHT = 60
const SLOT = 10
const GAP = 2

// A plain SVG bar chart of one value per day for the admin dashboard — no chart library. Each day
// carries a <title> (hover) with its date and values; the chart as a whole is labelled with its
// sum and its highest day for screen readers.
export function DailyBars({ title, days, series, format = String }: DailyBarsProps) {
  const totals = stackTotals(series.map((item) => item.values))
  const max = seriesMax(totals)
  const peak = totals.indexOf(max)
  const summary =
    max > 0
      ? `${title}: zusammen ${format(seriesSum(totals))}, höchster Tag ${formatDay(days[peak])} mit ${format(max)}`
      : `${title}: keine Werte im Zeitraum`

  return (
    <figure className="flex flex-col gap-1 border border-border bg-surface p-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm text-ink">
        <span>{title}</span>
        <span className="text-ink-soft">zusammen {format(seriesSum(totals))}</span>
      </figcaption>
      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${days.length * SLOT} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-16 w-full"
      >
        {days.map((day, index) => {
          const heights = series.map((item) => barHeight(item.values[index] ?? 0, max, HEIGHT))
          return (
            <g key={day}>
              <title>
                {`${formatDay(day)}: ${series.map((item) => `${series.length > 1 ? `${item.name} ` : ''}${format(item.values[index] ?? 0)}`).join(', ')}`}
              </title>
              {/* The full-height strip keeps a day's tooltip reachable even when its bar is empty. */}
              <rect x={index * SLOT} y={0} width={SLOT} height={HEIGHT} className="fill-transparent" />
              {series.map((item, layer) => (
                <rect
                  key={item.name}
                  x={index * SLOT + GAP / 2}
                  y={HEIGHT - seriesSum(heights.slice(0, layer + 1))}
                  width={SLOT - GAP}
                  height={heights[layer]}
                  className={item.fill}
                />
              ))}
            </g>
          )
        })}
      </svg>
      <div className="flex justify-between font-mono text-xs text-ink-soft" aria-hidden="true">
        <span>{days.length ? formatDay(days[0]) : ''}</span>
        <span>{days.length ? formatDay(days[days.length - 1]) : ''}</span>
      </div>
      {series.length > 1 ? (
        <ul className="flex flex-wrap gap-x-4 text-xs text-ink-soft">
          {series.map((item) => (
            <li key={item.name} className="flex items-center gap-1">
              <svg aria-hidden="true" viewBox="0 0 10 10" className="h-2.5 w-2.5">
                <rect width={10} height={10} className={item.fill} />
              </svg>
              {item.name}
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  )
}
