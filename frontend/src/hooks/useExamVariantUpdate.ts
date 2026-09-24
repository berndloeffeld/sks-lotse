import type { ExamVariant } from '../api/types'
import { useAuthStore } from '../store/authStore'
import { useAsyncAction } from './useAsyncAction'

// Saving the exam variant (PATCH /auth/me) from the dropdown on /learn and
// /profile — same request, same busy/error state on both pages.
export function useExamVariantUpdate() {
  const updateUser = useAuthStore((state) => state.updateUser)
  const { run, isPending, error } = useAsyncAction()

  function changeVariant(variant: ExamVariant) {
    return run(() => updateUser({ exam_variant: variant }), 'Die Prüfungsvariante konnte nicht gespeichert werden.')
  }

  return { changeVariant, isSaving: isPending, error }
}
