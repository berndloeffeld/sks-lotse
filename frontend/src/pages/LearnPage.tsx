import { Link, useSearchParams } from 'react-router-dom'

import { apiClient } from '../api/client'
import type { RefreshSummary } from '../api/types'
import { topicQuestions, topicsBySubject, type GuestCatalog } from '../catalog'
import { Band, Columns } from '../components/Bands'
import { ExamOverview } from '../components/ExamOverview'
import { FocusBand } from '../components/FocusBand'
import { LearnModePanel, LearnModeTabs, RefreshPanel } from '../components/LearnModes'
import { LedgerRow } from '../components/LedgerRow'
import { GuestCta } from '../components/LoginLink'
import { PageLayout } from '../components/PageLayout'
import { ProgressOverview } from '../components/ProgressOverview'
import { useApiQuery } from '../hooks/useApiQuery'
import { useCatalog } from '../hooks/useCatalog'
import { useProgressSummary } from '../hooks/useProgressSummary'
import { SUBJECT_LABELS } from '../labels'
import { learnModes, type LearnMode } from '../navigation'
import { useAuthStore } from '../store/authStore'

// The Lernstand, banded like the landing page: overall progress, the
// per-category pie and the exam-variant picker as three columns, then the
// learning modes as tabs: every topic grouped by subject, the Fokus topics,
// the Auffrischen session, and with the Kartenaufgaben the Probeprüfung.
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
  const modes = learnModes(useAuthStore((state) => state.user?.can_use_chart_exercises ?? false))
  const requested = searchParams.get('modus')
  const mode = modes.find((candidate) => candidate === requested) ?? 'topic'
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

      <LearnModeTabs active={mode} onChange={selectMode} modes={modes} />

      <LearnModePanel mode={mode}>
        {mode === 'exam' ? (
          <Band className="py-10">
            <div className="max-w-2xl">
              <ExamOverview />
            </div>
          </Band>
        ) : mode === 'refresh' ? (
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

const GUEST_ROW_ACTION =
  'border border-primary px-3 py-1.5 font-mono text-xs tracking-wide text-primary uppercase hover:bg-primary hover:text-surface'

// /learn without a login (ADR-0054): every topic of the catalog, open to practise, and what an account
// adds. No Lernstand, Fokus, Auffrischen or Probeprüfung, and no exam variant, so both
// Seemannschaft variants are listed.
function GuestLearnContent() {
  const { catalog, failed } = useCatalog()

  return (
    <>
      <Band className="pt-10 pb-0">
        <GuestCta>
          Alle Fragen des amtlichen Katalogs, frei zum Üben. Ohne Anmeldung wird nichts gespeichert. Mit Anmeldung
          speichert SKS Lotse deinen Lernstand, und du bekommst Fokus-Themen, Auffrischen, die Probeprüfung und den
          Lotsen-Check.
        </GuestCta>
      </Band>
      <Band className="py-10">
        {failed ? (
          <p className="text-sm text-danger">Die Themen konnten nicht geladen werden.</p>
        ) : !catalog ? (
          <p className="text-sm text-ink-soft">Themen werden geladen…</p>
        ) : (
          <GuestTopics catalog={catalog} />
        )}
      </Band>
    </>
  )
}

function GuestTopics({ catalog }: { catalog: GuestCatalog }) {
  return (
    <Columns className="sm:grid-cols-2">
      {Array.from(topicsBySubject(catalog.topics).entries()).map(([subject, topics]) => (
        <div key={subject} className="flex flex-col gap-2">
          <h3 className="font-serif text-2xl text-primary">{SUBJECT_LABELS[subject] ?? subject}</h3>
          <div>
            {topics.map((topic) => (
              <div
                key={topic.slug}
                className="flex items-center justify-between gap-4 border-b border-border px-2 py-3 last:border-b-0"
              >
                <div className="flex-1">
                  <p className="text-ink">{topic.name}</p>
                  <p className="mt-1 font-mono text-xs text-ink-soft">
                    {topicQuestions(catalog, subject, topic.slug).length} Fragen
                  </p>
                </div>
                <Link to={`/learn/${subject}/${topic.slug}`} className={GUEST_ROW_ACTION}>
                  Lernen starten
                </Link>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Columns>
  )
}

// Open without a login (ADR-0054): the prerendered page is the guest's, and becomes the learner's
// Lernstand once the session check knows them.
export function LearnPage() {
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return (
    <PageLayout
      title="Lernen"
      subtitle="Wähle ein Thema und arbeite dich durch den amtlichen Fragenkatalog."
      nav="public"
      bands
    >
      {/* Keyed on exam_variant so a change remounts (and refetches) the
          Lernstand for the new variant's subjects. */}
      {isAuthenticated ? <LearnContent key={user?.exam_variant ?? 'none'} /> : <GuestLearnContent />}
    </PageLayout>
  )
}
