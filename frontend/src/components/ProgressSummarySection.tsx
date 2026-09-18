import { useCallback, useEffect, useState } from 'react'

import { apiClient } from '../api/client'
import type { TopicProgress } from '../api/types'
import { LedgerRow } from './LedgerRow'
import { ProgressSummaryTile } from './ProgressSummaryTile'

const SUBJECT_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  schifffahrtsrecht: 'Schifffahrtsrecht',
  wetterkunde: 'Wetterkunde',
  seemannschaft_allgemein: 'Seemannschaft',
  seemannschaft_motor: 'Seemannschaft (Motor)',
  seemannschaft_segeln: 'Seemannschaft (Segeln)',
}

export function ProgressSummarySection() {
  const [progress, setProgress] = useState<TopicProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  // No setState before the first `await` here — the initial "loading" state
  // is covered by useState(true) above, not by a synchronous call in the
  // effect body (react-hooks/set-state-in-effect).
  const fetchProgress = useCallback(async () => {
    try {
      const data = await apiClient.get<TopicProgress[]>('/progress/summary')
      setProgress(data)
    } catch {
      setError('Der Lernstand konnte nicht geladen werden.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Standard fetch-on-mount: no external store for this component-local
    // data, and nothing else ever triggers a second concurrent call, so the
    // stricter "no setState from an effect" pattern doesn't apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProgress()
  }, [fetchProgress])

  // /progress/summary is already ordered by (subject, display_order) —
  // grouping via Map preserves that order for the subject headings below.
  const bySubject = new Map<string, TopicProgress[]>()
  for (const topic of progress) {
    const topics = bySubject.get(topic.subject) ?? []
    topics.push(topic)
    bySubject.set(topic.subject, topics)
  }

  const totals = progress.reduce(
    (acc, topic) => ({
      learned: acc.learned + topic.learned_questions,
      total: acc.total + topic.total_questions,
    }),
    { learned: 0, total: 0 },
  )

  return (
    <section className="flex flex-col gap-6">
      <h2 className="font-serif text-lg text-ink">Lernstand</h2>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {isLoading ? (
        <p className="text-sm text-ink-soft">Lernstand wird geladen…</p>
      ) : progress.length === 0 ? (
        <p className="text-sm text-ink-soft">Keine Themen gefunden.</p>
      ) : (
        <>
          <ProgressSummaryTile learned={totals.learned} total={totals.total} />
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
