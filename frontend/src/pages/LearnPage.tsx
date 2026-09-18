import { Link } from 'react-router-dom'

import { ContourBackground } from '../components/ContourBackground'
import { ExamVariantDropdown } from '../components/ExamVariantDropdown'
import { LegalFooter } from '../components/LegalFooter'
import { ProgressSummarySection } from '../components/ProgressSummarySection'
import { useExamVariantUpdate } from '../hooks/useExamVariantUpdate'
import { useAuthStore } from '../store/authStore'

export function LearnPage() {
  const user = useAuthStore((state) => state.user)
  const { changeVariant, isSaving: isSavingVariant, error } = useExamVariantUpdate()

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
          <ExamVariantDropdown value={user?.exam_variant ?? null} onChange={changeVariant} disabled={isSavingVariant} />
        </div>
      </header>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {/* Keyed on exam_variant so a change remounts (and refetches) this
          section — it has no props, since it's shared as-is with ProfilePage. */}
      <ProgressSummarySection key={user?.exam_variant ?? 'none'} collapsible={false} />

      <LegalFooter />
    </main>
  )
}
