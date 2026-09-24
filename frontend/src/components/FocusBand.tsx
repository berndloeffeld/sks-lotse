import { Link } from 'react-router-dom'

import type { TopicProgress } from '../api/types'
import { percentOf } from '../format'
import { SUBJECT_LABELS } from '../labels'
import { formStyles } from './formStyles'
import { Band } from './Bands'
import { LedgerRow } from './LedgerRow'

interface FocusBandProps {
  topics: TopicProgress[]
  totals: { learned: number; learning: number; total: number }
  onToggleFocus: (topic: TopicProgress) => void
  error?: string | null
}

// The topics the learner marked as Fokus, with how many of their questions
// are "sicher gelernt" and how many "teilweise".
// A topic drops out on its own once all its questions are learned (ADR-0028),
// so there is nothing to do here for that.
export function FocusBand({ topics, totals, onToggleFocus, error }: FocusBandProps) {
  const open = totals.total - totals.learned - totals.learning
  const learnedPercent = percentOf(totals.learned, totals.total)
  const learningPercent = percentOf(totals.learning, totals.total)

  return (
    <Band className="py-14">
      {/* pr-2 matches the LedgerRow inset, so the button lines up with the "Lernen starten" buttons below. */}
      <div className="flex items-center justify-between gap-4 pr-2">
        <h2 className="font-serif text-3xl text-primary">Fokus</h2>
        {/* Everything not yet gelernt (offen + teilweise) is in the session, oldest correct answer first. */}
        {topics.length > 0 && totals.total > totals.learned ? (
          <Link to="/learn/fokus" className={formStyles('light').button}>
            Fokus-Lernen starten
          </Link>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {topics.length === 0 ? (
        <p className="mt-3 max-w-xl text-sm text-ink-soft">
          Markiere Themen mit dem Stern, um sie hier im Blick zu behalten. Ein Thema verschwindet aus dem Fokus, sobald
          du alle Fragen sicher gelernt hast.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <div className="flex h-1.5 w-full bg-surface-alt" role="img" aria-label="Fortschritt der Fokus-Themen">
              <div className="h-full bg-success" style={{ width: `${learnedPercent}%` }} />
              <div className="h-full bg-success opacity-40" style={{ width: `${learningPercent}%` }} />
            </div>
            <p className="font-mono text-xs text-ink-soft">
              {totals.learned} sicher gelernt · {totals.learning} teilweise · {open} offen (von {totals.total} Fragen)
            </p>
          </div>
          <div>
            {topics.map((topic) => (
              <LedgerRow
                key={`${topic.subject}/${topic.topic_slug}`}
                title={`${topic.topic_name} (${SUBJECT_LABELS[topic.subject] ?? topic.subject})`}
                learned={topic.learned_questions}
                learning={topic.learning_questions}
                total={topic.total_questions}
                to={`/learn/${topic.subject}/${topic.topic_slug}`}
                isFocus
                onToggleFocus={() => onToggleFocus(topic)}
              />
            ))}
          </div>
        </div>
      )}
    </Band>
  )
}
