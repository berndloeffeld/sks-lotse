// "Kurs auf den Hafen" (ADR-0024): a boat sailing a markless course toward an
// anchor. It shows how far along a question is, never how many steps are
// left — no ticks, no segments. At "gelernt" it lies at anchor, in the same
// success green the /learn progress bars use for "gelernt".
//
// A change of `progress` glides the boat there (forward on a correct answer,
// back to the start on a reset), unless the user prefers reduced motion.
// Remount it (key) for a different question, so it doesn't sail across from
// the previous question's position.

const TRACK_END = 96
// The boat's left edge at "gelernt": bow just short of the anchor.
const BOAT_MAX_X = 78
// Short of BOAT_MAX_X, so "almost learned" never reads as "at anchor".
const BOAT_SAILING_MAX_X = 70

function label(progress: number): string {
  if (progress >= 1) return 'Gelernt'
  if (progress <= 0) return 'Noch nicht gelernt'
  return 'Auf Kurs zu gelernt'
}

// Hover text while still sailing: explains what moves the boat without
// naming the method or a count, so it can't be gamed (ADR-0024).
const SAILING_HINT =
  'Der Kurs berücksichtigt deine bisherigen Antworten und wie viel Zeit dazwischen lag – regelmäßiges Wiederholen bringt das Schiff näher zum Anker.'

export function CourseGauge({ progress }: { progress: number }) {
  const learned = progress >= 1
  const text = label(progress)
  const tooltip = learned ? text : SAILING_HINT
  const x = learned ? BOAT_MAX_X : Math.max(progress, 0) * BOAT_SAILING_MAX_X
  const motion = 'transition-[transform,color] duration-700 ease-in-out motion-reduce:transition-none'

  return (
    <svg role="img" aria-label={text} viewBox="0 0 112 24" className="h-6 w-28 shrink-0">
      <title>{tooltip}</title>
      <line
        x1={2}
        y1={19}
        x2={TRACK_END}
        y2={19}
        className={learned ? 'stroke-success' : 'stroke-border'}
        strokeDasharray={learned ? undefined : '3 3'}
      />
      <g
        data-testid="course-boat"
        className={`${motion} ${learned ? 'text-success' : 'text-primary'}`}
        style={{ transform: `translate(${x}px, 1px)` }}
        fill="currentColor"
      >
        <path d="M1 14h18l-3.5 5h-11z" />
        <rect x={9.3} y={1} width={1.4} height={13} />
        <path d="M11.5 2 18 12.5h-6.5z" />
        <path d="M8.5 4 3 12.5h5.5z" opacity={0.6} />
      </g>
      <g
        transform="translate(101 10)"
        fill="none"
        strokeWidth={1.3}
        strokeLinecap="round"
        className={`${motion} ${learned ? 'text-success' : 'text-ink-soft'}`}
        stroke="currentColor"
      >
        <circle cx={5} cy={1.5} r={1.3} />
        <path d="M5 3v9M2.5 5h5M1 9q1 3.5 4 3 3 .5 4-3" />
      </g>
    </svg>
  )
}
