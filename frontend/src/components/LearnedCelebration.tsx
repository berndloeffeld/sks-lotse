import type { CSSProperties } from 'react'

// Shown for a moment when a question has just become "gelernt": a green
// "vor Anker" banner over the page with confetti drifting up from it. Purely
// decorative — the result is announced to screen readers separately — and
// not rendered at all under reduced motion.

export const CELEBRATION_MS = 2600
const CONFETTI_MS = 1800

const CONFETTI = ['bg-success', 'bg-accent', 'bg-primary', 'bg-surface'] as const
const PIECES = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI - Math.PI
  return {
    color: CONFETTI[i % CONFETTI.length],
    dx: Math.round(Math.cos(angle) * (70 + (i % 3) * 25)),
    dy: Math.round(Math.sin(angle) * (60 + (i % 4) * 20)) - 20,
    rot: (i % 2 ? 1 : -1) * (120 + i * 25),
    delay: (i % 5) * 40,
  }
})

function Anchor() {
  return (
    <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx={12} cy={5} r={2.3} />
      <path d="M12 7.5V21M8 11h8M4 14q1 6 8 7 7-1 8-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function LearnedCelebration({ questionNumber }: { questionNumber: number }) {
  return (
    <div
      data-testid="learned-celebration"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center motion-reduce:hidden"
    >
      <div
        className="relative flex flex-col items-center gap-1 rounded-tile bg-success px-10 py-6 text-surface shadow-xl"
        style={{ animation: `celebrate-pop ${CELEBRATION_MS}ms ease-out forwards` }}
      >
        <Anchor />
        <p className="font-serif text-3xl">Gelernt!</p>
        <p className="font-mono text-xs tracking-wide uppercase">Sicher vor Anker · Nr. {questionNumber}</p>
        {PIECES.map((piece, i) => (
          <span
            key={i}
            className={`absolute top-1/2 left-1/2 h-2 w-2 ${piece.color}`}
            style={
              {
                '--dx': `${piece.dx}px`,
                '--dy': `${piece.dy}px`,
                '--rot': `${piece.rot}deg`,
                animation: `celebrate-confetti ${CONFETTI_MS}ms ease-out ${piece.delay}ms forwards`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  )
}
