import { useId } from 'react'

export interface ProgressSlice {
  key: string
  label: string
  learned: number
  total: number
}

interface ProgressPieProps {
  slices: ProgressSlice[]
}

// Category colors from the ADR-0014 palette — deliberately not a traffic-light
// scheme. The learned share is carried by opacity, not by hue.
const SLICE_COLORS = ['var(--color-primary)', 'var(--color-accent)', 'var(--color-success)', 'var(--color-ink-soft)']

const SIZE = 220
const CENTER = SIZE / 2
const RADIUS = 104
const FADE_EDGE = 0.15
const FADED_OPACITY = 0.16

function pointAt(angle: number): [number, number] {
  return [CENTER + RADIUS * Math.sin(angle), CENTER - RADIUS * Math.cos(angle)]
}

// Pie whose slice size is the category's share of all questions and whose
// fill runs strong-to-faint from the center outward: the strong region reaches
// out to learned/total of the radius, so a fully learned slice is solid.
export function ProgressPie({ slices }: ProgressPieProps) {
  const idPrefix = useId()
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
    <div className="flex flex-wrap items-center gap-6">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Lernstand nach Kategorie"
        className="h-[220px] w-[220px] shrink-0"
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
              <stop offset={0} stopColor={color} stopOpacity={1} />
              <stop offset={fraction} stopColor={color} stopOpacity={1} />
              <stop offset={Math.min(1, fraction + FADE_EDGE)} stopColor={color} stopOpacity={FADED_OPACITY} />
              <stop offset={1} stopColor={color} stopOpacity={FADED_OPACITY} />
            </radialGradient>
          ))}
        </defs>
        {rendered.map(({ gradientId, path, summary }) => (
          <path key={gradientId} d={path} fill={`url(#${gradientId})`} stroke="var(--color-surface)" strokeWidth={2}>
            <title>{summary}</title>
          </path>
        ))}
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="var(--color-ink)" strokeWidth={1} />
      </svg>
      <ul className="flex min-w-[220px] flex-1 flex-col gap-2">
        {rendered.map(({ slice, color }) => (
          <li key={slice.key} className="flex items-center gap-3 text-sm text-ink">
            <span aria-hidden className="h-3.5 w-3.5 shrink-0" style={{ background: color }} />
            <span className="flex-1">{slice.label}</span>
            <span className="font-mono text-xs text-ink-soft">
              {slice.learned} / {slice.total} · {Math.round((slice.learned / slice.total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
