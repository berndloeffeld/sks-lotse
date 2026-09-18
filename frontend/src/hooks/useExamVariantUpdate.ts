import { useState } from 'react'

import type { ExamVariant } from '../api/types'
import { useAuthStore } from '../store/authStore'

// Saving the exam variant (PATCH /auth/me) from the dropdown on /learn and
// /profile — same request, same busy/error state on both pages.
export function useExamVariantUpdate() {
  const updateUser = useAuthStore((state) => state.updateUser)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function changeVariant(variant: ExamVariant) {
    setIsSaving(true)
    setError(null)
    try {
      await updateUser({ exam_variant: variant })
    } catch {
      setError('Die Prüfungsvariante konnte nicht gespeichert werden.')
    } finally {
      setIsSaving(false)
    }
  }

  return { changeVariant, isSaving, error }
}
