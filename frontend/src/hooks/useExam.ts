import { useCallback, useEffect, useState } from 'react'

import { apiClient } from '../api/client'
import type { Exam } from '../api/types'

// Loads one exam and lets the page swap in fresher server state (each write
// endpoint returns the full exam, and an expired exam is re-read).
export function useExam(id: string | undefined) {
  const [exam, setExam] = useState<Exam | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setExam(await apiClient.get<Exam>(`/exams/${id}`))
      setError(null)
    } catch {
      setError('Die Prüfung konnte nicht geladen werden.')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    // Standard fetch-on-mount, same reasoning as useProgressSummary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload()
  }, [reload])

  return { exam, setExam, reload, isLoading, error }
}
