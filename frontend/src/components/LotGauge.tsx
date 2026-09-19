// Mirrors LEARNED_STREAK_THRESHOLD in backend/app/core/progress.py.
export const LEARNED_STREAK = 3

const WIDTH = 96
const PAD = 6
const STEP = (WIDTH - 2 * PAD) / LEARNED_STREAK

// The "Lot gauge" from ADR-0014: a short line with a tick per consecutive
// "Richtig" needed, a dot advancing along it with the streak, and a small
// anchor once the question is "gelernt" (ADR-0018). Resets to empty on any
// other grading — it shows the streak, not a cumulative count.
export function LotGauge({ streak }: { streak: number }) {
  const learned = streak >= LEARNED_STREAK
  const x = PAD + Math.min(streak, LEARNED_STREAK) * STEP
  const label = learned ? 'Gelernt' : `${streak} von ${LEARNED_STREAK} Mal in Folge richtig`

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${WIDTH} 20`}
      className="h-5 w-24 text-ink"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
    >
      <title>{label}</title>
      <line x1={PAD} y1={10} x2={WIDTH - PAD} y2={10} className="text-border" stroke="currentColor" />
      {Array.from({ length: LEARNED_STREAK + 1 }, (_, i) => (
        <line key={i} x1={PAD + i * STEP} y1={6} x2={PAD + i * STEP} y2={14} />
      ))}
      {learned ? (
        // Anchor: ring, shank, stock and flukes.
        <g className="text-success" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
          <circle cx={x} cy={3.5} r={1.8} className="fill-bg" />
          <line x1={x} y1={5.3} x2={x} y2={17} />
          <line x1={x - 3} y1={8} x2={x + 3} y2={8} />
          <path d={`M${x - 5} 13 Q${x - 4} 17.5 ${x} 17 Q${x + 4} 17.5 ${x + 5} 13`} />
        </g>
      ) : (
        <circle cx={x} cy={10} r={3} className="fill-primary" stroke="none" />
      )}
    </svg>
  )
}
