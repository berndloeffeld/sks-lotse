import { Link } from 'react-router-dom'

import { percentOf } from '../format'

interface LedgerRowProps {
  title: string
  learned: number
  total: number
  // Where "Lernen starten" leads; the button stays disabled without it or
  // for a topic with no questions.
  to?: string
}

// The "ledger list rows" pattern from ADR-0014: flat rows separated by
// hairlines (not boxed cards), counts set in IBM Plex Mono. Used for the
// per-topic Lernstand list on /learn.
export function LedgerRow({ title, learned, total, to }: LedgerRowProps) {
  const percent = percentOf(learned, total)
  const action = 'border px-3 py-1.5 font-mono text-xs tracking-wide uppercase'

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div className="flex-1">
        <p className="text-ink">{title}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1 w-20 bg-surface-alt">
            <div className="h-full bg-success" style={{ width: `${percent}%` }} />
          </div>
          <p className="font-mono text-xs text-ink-soft">
            {learned} von {total} Fragen gelernt
          </p>
        </div>
      </div>
      {to && total > 0 ? (
        <Link to={to} className={`${action} border-primary text-primary hover:bg-primary hover:text-surface`}>
          Lernen starten
        </Link>
      ) : (
        <button type="button" disabled className={`${action} border-border text-ink-soft disabled:cursor-not-allowed`}>
          Lernen starten
        </button>
      )}
    </div>
  )
}
