import { useSearchParams } from 'react-router-dom'

import { apiClient } from '../api/client'
import type { RefreshSummary } from '../api/types'
import { Band, Columns } from '../components/Bands'
import { FocusBand } from '../components/FocusBand'
import { LearnModePanel, LearnModeTabs, RefreshPanel, type LearnMode } from '../components/LearnModes'
import { LedgerRow } from '../components/LedgerRow'
import { PageLayout } from '../components/PageLayout'
import { ProgressOverview } from '../components/ProgressOverview'
import { useApiQuery } from '../hooks/useApiQuery'
import { useProgressSummary } from '../hooks/useProgressSummary'
import { SUBJECT_LABELS } from '../labels'
import { useAuthStore } from '../store/authStore'

// The Lernstand, banded like the landing page: overall progress, the
// per-category pie and the exam-variant picker as three columns, then the
// three learning modes as tabs: every topic grouped by subject, the Fokus
// topics, and the Auffrischen session.
function LearnContent() {
  const {
    progress,
    isLoading,
    error,
    totals,
    categories,
    bySubject,
    focusTopics,
    focusTotals,
    toggleFocus,
    focusError,
  } = useProgressSummary()

  // The mode lives in the URL (?modus=focus), so a way back from a run lands on the same tab.
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('modus')
  const mode: LearnMode = requested === 'focus' || requested === 'refresh' ? requested : 'topic'
  const selectMode = (next: LearnMode) => setSearchParams(next === 'topic' ? {} : { modus: next }, { replace: true })

  // The Auffrischen counts; a failed request reads as "nothing to do".
  const refresh = useApiQuery('refresh-summary', () => apiClient.get<RefreshSummary>('/progress/refresh/summary'))
  const refreshSummary = refresh.isLoading ? null : (refresh.data ?? { lapsed: 0, expiring: 0, fresh: 0 })

  const status = isLoading ? (
    <p className="text-sm text-ink-soft">Lernstand wird geladen…</p>
  ) : error ? (
    <p className="text-sm text-danger">{error}</p>
  ) : progress.length === 0 ? (
    <p className="text-sm text-ink-soft">Keine Themen gefunden.</p>
  ) : null

  return (
    <>
      <Band className="pt-10 pb-12">
        <ProgressOverview totals={totals} categories={categories} />
      </Band>

      <LearnModeTabs active={mode} onChange={selectMode} />

      <LearnModePanel mode={mode}>
        {mode === 'refresh' ? (
          <RefreshPanel summary={refreshSummary} />
        ) : status ? (
          <Band>{status}</Band>
        ) : mode === 'focus' ? (
          <FocusBand topics={focusTopics} totals={focusTotals} onToggleFocus={toggleFocus} error={focusError} />
        ) : (
          <Band className="py-10">
            {focusError ? <p className="mb-6 text-sm text-danger">{focusError}</p> : null}
            <Columns className="sm:grid-cols-2">
              {Array.from(bySubject.entries()).map(([subject, topics]) => (
                <div key={subject} className="flex flex-col gap-2">
                  <h3 className="font-serif text-2xl text-primary">{SUBJECT_LABELS[subject] ?? subject}</h3>
                  <div>
                    {topics.map((topic) => (
                      <LedgerRow
                        key={topic.topic_slug}
                        title={topic.topic_name}
                        learned={topic.learned_questions}
                        learning={topic.learning_questions}
                        total={topic.total_questions}
                        to={`/learn/${topic.subject}/${topic.topic_slug}`}
                        isFocus={topic.is_focus}
                        onToggleFocus={() => toggleFocus(topic)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </Columns>
          </Band>
        )}
      </LearnModePanel>
    </>
  )
}

export function LearnPage() {
  const user = useAuthStore((state) => state.user)

  return (
    <PageLayout title="Lernen" subtitle="Wähle ein Thema und arbeite dich durch den amtlichen Fragenkatalog." bands>
      {/* Keyed on exam_variant so a change remounts (and refetches) the
          Lernstand for the new variant's subjects. */}
      <LearnContent key={user?.exam_variant ?? 'none'} />
    </PageLayout>
  )
}
