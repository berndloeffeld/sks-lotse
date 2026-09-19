import { Band, Columns } from '../components/Bands'
import { FocusBand } from '../components/FocusBand'
import { LedgerRow } from '../components/LedgerRow'
import { PageLayout } from '../components/PageLayout'
import { ProgressOverview } from '../components/ProgressOverview'
import { SUBJECT_LABELS, useProgressSummary } from '../hooks/useProgressSummary'
import { useAuthStore } from '../store/authStore'

// The Lernstand, banded like the landing page: overall progress, the
// per-category pie and the exam-variant picker as three columns, then every
// topic grouped by subject.
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

  const status = isLoading ? (
    <p className="text-sm text-ink-soft">Lernstand wird geladen…</p>
  ) : error ? (
    <p className="text-sm text-danger">{error}</p>
  ) : progress.length === 0 ? (
    <p className="text-sm text-ink-soft">Keine Themen gefunden.</p>
  ) : null

  return (
    <>
      <Band className="pt-10 pb-16">
        <ProgressOverview totals={totals} categories={categories} />
      </Band>

      {status ? null : (
        <FocusBand topics={focusTopics} totals={focusTotals} onToggleFocus={toggleFocus} error={focusError} />
      )}

      <Band tone="dark" className="py-14">
        <h2 className="font-serif text-3xl">Themen</h2>
        <p className="mt-3 max-w-xl text-sm text-surface-alt">
          Alle Themen des amtlichen Katalogs, nach Fachgebiet sortiert.
        </p>
      </Band>

      <Band>
        {status ?? (
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
        )}
      </Band>
    </>
  )
}

export function LearnPage() {
  const user = useAuthStore((state) => state.user)

  return (
    <PageLayout
      title="Lernen"
      backTo="/start"
      subtitle="Wähle ein Thema und arbeite dich durch den amtlichen Fragenkatalog."
      bands
    >
      {/* Keyed on exam_variant so a change remounts (and refetches) the
          Lernstand for the new variant's subjects. */}
      <LearnContent key={user?.exam_variant ?? 'none'} />
    </PageLayout>
  )
}
