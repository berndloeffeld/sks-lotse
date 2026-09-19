import { Band, Columns } from '../components/Bands'
import { ExamVariantDropdown } from '../components/ExamVariantDropdown'
import { LedgerRow } from '../components/LedgerRow'
import { PageLayout } from '../components/PageLayout'
import { percentOf } from '../format'
import { SUBJECT_LABELS, useProgressSummary } from '../hooks/useProgressSummary'
import { useExamVariantUpdate } from '../hooks/useExamVariantUpdate'
import { useAuthStore } from '../store/authStore'

function Bar({ percent, tone }: { percent: number; tone: 'light' | 'dark' }) {
  return (
    <div className={`h-1.5 w-full ${tone === 'light' ? 'bg-surface-alt' : 'bg-primary-dark'}`}>
      <div className={`h-full ${tone === 'light' ? 'bg-success' : 'bg-surface'}`} style={{ width: `${percent}%` }} />
    </div>
  )
}

// The Lernstand, banded like the landing page: key figures as three
// columns, the exam's main categories on a primary band, then every topic
// grouped by subject.
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
            <Bar percent={percent} tone="light" />
            <p className="font-mono text-xs text-ink-soft">
              {totals.learned} von {totals.total} Fragen gelernt
            </p>
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
          <div className="flex flex-col gap-4">
            <h2 className="font-serif text-2xl text-primary">Gelernt heißt</h2>
            <p className="text-sm leading-relaxed text-ink-soft">
              Eine Frage gilt als gelernt, wenn du sie dreimal in Folge richtig beantwortest. „Teilweise richtig“ oder
              „falsch“ setzt die Serie zurück.
            </p>
          </div>
        </Columns>
      </Band>

      {categories.length > 0 ? (
        <Band tone="primary">
          <h2 className="sr-only">Fachgebiete</h2>
          <Columns className="sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => {
              const categoryPercent = percentOf(category.learned, category.total)
              return (
                <div key={category.key} className="flex flex-col gap-4">
                  <h3 className="font-serif text-2xl">{category.label}</h3>
                  <Bar percent={categoryPercent} tone="dark" />
                  <p className="font-mono text-xs text-surface-alt">
                    {category.learned} von {category.total} · {categoryPercent}%
                  </p>
                </div>
              )
            })}
          </Columns>
        </Band>
      ) : null}

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
