import { ExamVariantDropdown } from '../components/ExamVariantDropdown'
import { PageLayout } from '../components/PageLayout'
import { ProgressSummarySection } from '../components/ProgressSummarySection'
import { useExamVariantUpdate } from '../hooks/useExamVariantUpdate'
import { useAuthStore } from '../store/authStore'

export function LearnPage() {
  const user = useAuthStore((state) => state.user)
  const { changeVariant, isSaving: isSavingVariant, error } = useExamVariantUpdate()

  return (
    <PageLayout title="Lernen" backTo="/start">
      <div className="flex justify-end">
        <ExamVariantDropdown value={user?.exam_variant ?? null} onChange={changeVariant} disabled={isSavingVariant} />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {/* Keyed on exam_variant so a change remounts (and refetches) this
          section — it has no props, since it's shared as-is with ProfilePage. */}
      <ProgressSummarySection key={user?.exam_variant ?? 'none'} collapsible={false} />
    </PageLayout>
  )
}
