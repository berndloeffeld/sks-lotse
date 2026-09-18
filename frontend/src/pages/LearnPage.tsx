import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiClient } from '../api/client'
import type { TopicProgress } from '../api/types'
import { ContourBackground } from '../components/ContourBackground'
import { ExamVariantDropdown, type ExamVariant } from '../components/ExamVariantDropdown'
import { LedgerRow } from '../components/LedgerRow'
import { LegalFooter } from '../components/LegalFooter'
import { ProgressSummaryTile } from '../components/ProgressSummaryTile'
import { useAuthStore } from '../store/authStore'

const SUBJECT_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  schifffahrtsrecht: 'Schifffahrtsrecht',
  wetterkunde: 'Wetterkunde',
  seemannschaft_allgemein: 'Seemannschaft',
  seemannschaft_motor: 'Seemannschaft (Motor)',
  seemannschaft_segeln: 'Seemannschaft (Segeln)',
}

export function LearnPage() {
  const user = useAuthStore((state) => state.user)
  const checkSession = useAuthStore((state) => state.checkSession)

  const [progress, setProgress] = useState<TopicProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingVariant, setIsSavingVariant] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    // Standard fetch-on-mount: no external store for this page-local data,
    // and nothing else ever triggers a second concurrent call, so the
    // stricter "no setState from an effect" pattern doesn't apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProgress()
  }, [fetchProgress])

  async function handleExamVariantChange(variant: ExamVariant) {
    setIsSavingVariant(true)
    setError(null)
    try {
      await apiClient.patch('/auth/me', { exam_variant: variant })
      await checkSession()
      await fetchProgress()
    } catch {
      setError('Die Prüfungsvariante konnte nicht gespeichert werden.')
    } finally {
      setIsSavingVariant(false)
    }
  }

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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-12">
      <header className="relative overflow-hidden py-4">
        <ContourBackground className="h-24" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <Link to="/start" className="font-mono text-xs tracking-wide text-ink-soft uppercase hover:text-ink">
              ← Zurück
            </Link>
            <h1 className="mt-2 font-serif text-2xl text-ink">Lernen</h1>
          </div>
          <ExamVariantDropdown
            value={user?.exam_variant ?? null}
            onChange={handleExamVariantChange}
            disabled={isSavingVariant}
          />
        </div>
      </header>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <section className="flex flex-col gap-6">
        <h2 className="font-serif text-lg text-ink">Lernstand</h2>
        {isLoading ? (
          <p className="text-sm text-ink-soft">Lernstand wird geladen…</p>
        ) : progress.length === 0 ? (
          <p className="text-sm text-ink-soft">Keine Themen gefunden.</p>
        ) : (
          <>
            <ProgressSummaryTile learned={totals.learned} total={totals.total} />
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
          </>
        )}
      </section>

      <LegalFooter />
    </main>
  )
}
