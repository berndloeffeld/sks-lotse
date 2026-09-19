import { Band, Columns } from '../components/Bands'
import { ExamVariantDropdown } from '../components/ExamVariantDropdown'
import { LedgerRow } from '../components/LedgerRow'
import { PageLayout } from '../components/PageLayout'
import { ProgressPie } from '../components/ProgressPie'
import { percentOf } from '../format'
import { SUBJECT_LABELS, useProgressSummary } from '../hooks/useProgressSummary'
import { useExamVariantUpdate } from '../hooks/useExamVariantUpdate'
import { useAuthStore } from '../store/authStore'

function Bar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full bg-surface-alt">
      <div className="h-full bg-success" style={{ width: `${percent}%` }} />
    </div>
  )
}

// The Lernstand, banded like the landing page: overall progress, the
// per-category pie and the exam-variant picker as three columns, then every
// topic grouped by subject.
function LearnContent() {
  const user = useAuthStore((state) => state.user)
  const { changeVariant, isSaving: isSavingVariant, error: variantError } = useExamVariantUpdate()
  const { progress, isLoading, error, totals, categories, bySubject } = useProgressSummary()
  const percent = percentOf(totals.learned, totals.total)

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
        <Columns>
          <div className="flex flex-col gap-4">
            <h2 className="font-serif text-2xl text-primary">Gesamtfortschritt</h2>
            <p className="font-serif text-5xl text-ink">{percent}%</p>
            <Bar percent={percent} />
            <p className="font-mono text-xs text-ink-soft">
              {totals.learned} von {totals.total} Fragen gelernt
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <h2 className="font-serif text-2xl text-primary">Fachgebiete</h2>
            {categories.length > 0 ? <ProgressPie slices={categories} layout="column" /> : null}
          </div>
          <div className="flex flex-col gap-4">
            <h2 className="font-serif text-2xl text-primary">Prüfungsvariante</h2>
            <p className="text-sm leading-relaxed text-ink-soft">Bestimmt, welche Seemannschaft-Fragen du übst.</p>
            <ExamVariantDropdown
              value={user?.exam_variant ?? null}
              onChange={changeVariant}
              disabled={isSavingVariant}
            />
            {variantError ? <p className="text-sm text-danger">{variantError}</p> : null}
          </div>
        </Columns>
      </Band>

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
                      total={topic.total_questions}
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
