import { useState } from 'react'

import { SUBJECT_LABELS, useProgressSummary } from '../hooks/useProgressSummary'
import { LedgerRow } from './LedgerRow'
import { ProgressSummaryTile } from './ProgressSummaryTile'

// Compact Lernstand for the profile page: summary tile plus collapsible
// per-topic details. /learn has its own banded layout over the same data.
export function ProgressSummarySection() {
  const { progress, isLoading, error, totals, categories, bySubject } = useProgressSummary()
  const [showDetails, setShowDetails] = useState(false)

  return (
    <section className="flex flex-col gap-6">
      <h2 className="font-serif text-xl text-primary">Lernstand</h2>
      {isLoading ? (
        <p className="text-sm text-ink-soft">Lernstand wird geladen…</p>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : progress.length === 0 ? (
        <p className="text-sm text-ink-soft">Keine Themen gefunden.</p>
      ) : (
        <>
          <ProgressSummaryTile learned={totals.learned} total={totals.total} slices={categories} />
          <div className="border border-border">
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              aria-expanded={showDetails}
              className="flex w-full items-center justify-between px-4 py-3 font-mono text-xs tracking-wide text-ink-soft uppercase hover:bg-surface-alt"
            >
              Details {showDetails ? 'ausblenden' : 'anzeigen'}
              <span aria-hidden="true">{showDetails ? '−' : '+'}</span>
            </button>
            {showDetails ? (
              <div className="flex flex-col gap-4 border-t border-border p-4">
                {Array.from(bySubject.entries()).map(([subject, topics]) => (
                  <div key={subject}>
                    <h3 className="mb-1 font-mono text-xs tracking-wide text-ink-soft uppercase">
                      {SUBJECT_LABELS[subject] ?? subject}
                    </h3>
                    <div>
                      {topics.map((topic) => (
                        <LedgerRow
                          key={topic.topic_slug}
                          title={topic.topic_name}
                          learned={topic.learned_questions}
                          total={topic.total_questions}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
