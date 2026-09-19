import { useId, useState } from 'react'

import { percentOf } from '../format'

export interface ProgressSlice {
  key: string
  label: string
  learned: number
  total: number
}

interface ProgressPieProps {
  slices: ProgressSlice[]
  // `row`: legend beside the pie; `column`: legend underneath, for narrow
  // spots like one column of a three-column band.
  layout?: 'row' | 'column'
}

// Category colors from the ADR-0014 palette — deliberately not a traffic-light
// scheme. The learned share is carried by opacity, not by hue.
const SLICE_COLORS = ['var(--color-primary)', 'var(--color-accent)', 'var(--color-success)', 'var(--color-ink-soft)']

const SIZE = 220
const CENTER = SIZE / 2
const RADIUS = 104
const FADE_EDGE = 0.15
const FADED_OPACITY = 0.3
const DIMMED_OPACITY = 0.35

function pointAt(angle: number): [number, number] {
  return [CENTER + RADIUS * Math.sin(angle), CENTER - RADIUS * Math.cos(angle)]
}

// Pie whose slice size is the category's share of all questions and whose
// fill runs strong-to-faint from the center outward: the strong region reaches
// out to learned/total of the radius, so a fully learned slice is solid, and
// a slice with nothing learned has no strong core at all. Hovering a slice or
// its legend row highlights it and dims the rest.
export function ProgressPie({ slices, layout = 'row' }: ProgressPieProps) {
  const idPrefix = useId()
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const visible = slices.filter((slice) => slice.total > 0)
  const grandTotal = visible.reduce((sum, slice) => sum + slice.total, 0)
  if (grandTotal === 0) return null

  const rendered = visible.map((slice, index) => {
    const color = SLICE_COLORS[index % SLICE_COLORS.length]
    const fraction = slice.learned / slice.total
    const sweep = (2 * Math.PI * slice.total) / grandTotal
    const precedingTotal = visible.slice(0, index).reduce((sum, s) => sum + s.total, 0)
    const startAngle = (2 * Math.PI * precedingTotal) / grandTotal
    const endAngle = startAngle + sweep
    const gradientId = `${idPrefix}-g${index}`
    const summary = `${slice.label}: ${slice.learned} von ${slice.total} Fragen gelernt`

    let path: string
    if (visible.length === 1) {
      path = `M${CENTER - RADIUS} ${CENTER} a${RADIUS} ${RADIUS} 0 1 0 ${2 * RADIUS} 0 a${RADIUS} ${RADIUS} 0 1 0 ${-2 * RADIUS} 0 Z`
    } else {
      const [x0, y0] = pointAt(startAngle)
      const [x1, y1] = pointAt(endAngle)
      const largeArc = sweep > Math.PI ? 1 : 0
      path = `M${CENTER} ${CENTER} L${x0} ${y0} A${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x1} ${y1} Z`
    }

    return { slice, color, fraction, gradientId, path, summary }
  })

  return (
    <div className={`flex shrink-0 gap-4 ${layout === 'row' ? 'items-center' : 'flex-col items-start'}`}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Lernstand nach Kategorie"
        className="h-[130px] w-[130px] shrink-0"
      >
        <defs>
          {rendered.map(({ color, fraction, gradientId }) => (
            <radialGradient
              key={gradientId}
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
            >
              {fraction > 0 ? (
                <>
                  <stop offset={0} stopColor={color} stopOpacity={1} />
                  <stop offset={fraction} stopColor={color} stopOpacity={1} />
                </>
              ) : null}
              <stop
                offset={fraction > 0 ? Math.min(1, fraction + FADE_EDGE) : 0}
                stopColor={color}
                stopOpacity={FADED_OPACITY}
              />
              <stop offset={1} stopColor={color} stopOpacity={FADED_OPACITY} />
            </radialGradient>
          ))}
        </defs>
        {rendered.map(({ slice, gradientId, path, summary }) => (
          <path
            key={gradientId}
            d={path}
            fill={`url(#${gradientId})`}
            stroke="var(--color-surface)"
            strokeWidth={3}
            opacity={activeKey !== null && activeKey !== slice.key ? DIMMED_OPACITY : 1}
            onMouseEnter={() => setActiveKey(slice.key)}
            onMouseLeave={() => setActiveKey(null)}
          >
            <title>{summary}</title>
          </path>
        ))}
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="var(--color-ink)" strokeWidth={2} />
      </svg>
      <ul className="flex flex-col gap-1">
        {rendered.map(({ slice, color }) => (
          <li
            key={slice.key}
            onMouseEnter={() => setActiveKey(slice.key)}
            onMouseLeave={() => setActiveKey(null)}
            className={`flex items-center gap-2 border-l-[3px] px-1.5 py-0.5 text-sm text-ink ${
              activeKey === slice.key ? 'border-ink bg-bg' : 'border-transparent'
            }`}
          >
            <span aria-hidden className="h-3 w-3 shrink-0" style={{ background: color }} />
            <span>{slice.label}</span>
            <span className="ml-3 font-mono text-xs whitespace-nowrap text-ink-soft">
              {slice.learned} / {slice.total} · {percentOf(slice.learned, slice.total)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
