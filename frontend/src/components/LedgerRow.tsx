import { Link } from 'react-router-dom'

import { percentOf } from '../format'

interface LedgerRowProps {
  title: string
  learned: number
  total: number
  // Where "Lernen starten" leads; the button stays disabled without it or
  // for a topic with no questions.
  to?: string
  // Questions on the way to "gelernt" (streak 1–2), shown as a fainter bar
  // segment and in the count line.
  learning?: number
  // Renders the Fokus star when `onToggleFocus` is given.
  isFocus?: boolean
  onToggleFocus?: () => void
}

// The "ledger list rows" pattern from ADR-0014: flat rows separated by
// hairlines (not boxed cards), counts set in IBM Plex Mono. Used for the
// per-topic Lernstand list on /learn.
export function LedgerRow({ title, learned, total, to, learning = 0, isFocus = false, onToggleFocus }: LedgerRowProps) {
  const percent = percentOf(learned, total)
  const learningPercent = percentOf(learning, total)
  const done = total > 0 && learned >= total
  const action = 'border px-3 py-1.5 font-mono text-xs tracking-wide uppercase'

  return (
    <div
      className={`flex items-center justify-between gap-4 border-b border-border px-2 py-3 last:border-b-0 ${
        done ? 'bg-success/10' : ''
      }`}
    >
      {onToggleFocus ? (
        <button
          type="button"
          onClick={onToggleFocus}
          aria-pressed={isFocus}
          aria-label={isFocus ? `Fokus entfernen: ${title}` : `Als Fokus markieren: ${title}`}
          title={isFocus ? 'Fokus entfernen' : 'Als Fokus markieren'}
          className={`text-xl leading-none ${isFocus ? 'text-accent' : 'text-ink-soft hover:text-accent'}`}
        >
          <span aria-hidden="true">{isFocus ? '★' : '☆'}</span>
        </button>
      ) : null}
      <div className="flex-1">
        <p className={done ? 'font-medium text-success' : 'text-ink'}>
          {done ? (
            <span aria-hidden="true" className="mr-1.5">
              ✓
            </span>
          ) : null}
          {title}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex h-1 w-20 bg-surface-alt">
            <div className="h-full bg-success" style={{ width: `${percent}%` }} />
            <div className="h-full bg-success opacity-40" style={{ width: `${learningPercent}%` }} />
          </div>
          <p className={`font-mono text-xs ${done ? 'text-success' : 'text-ink-soft'}`}>
            {learned} von {total} Fragen gelernt
            {learning > 0 ? ` · ${learning} teilweise` : ''}
          </p>
        </div>
      </div>
      {to && total > 0 ? (
        <Link to={to} className={`${action} border-primary text-primary hover:bg-primary hover:text-surface`}>
          {done ? 'Wiederholen' : 'Lernen starten'}
        </Link>
      ) : (
        <button type="button" disabled className={`${action} border-border text-ink-soft disabled:cursor-not-allowed`}>
          Lernen starten
        </button>
      )}
    </div>
  )
}
