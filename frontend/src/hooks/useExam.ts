import { apiClient } from '../api/client'
import type { Exam } from '../api/types'
import { useApiQuery } from './useApiQuery'

// Loads one exam and lets the page swap in fresher server state (each write
// endpoint returns the full exam, and an expired exam is re-read).
export function useExam(id: string | undefined) {
  const { data, setData, reload, isLoading, failed } = useApiQuery(`exam:${id}`, () =>
    apiClient.get<Exam>(`/exams/${id}`),
  )
  return {
    exam: data ?? null,
    setExam: setData,
    reload,
    isLoading,
    error: failed ? 'Die Prüfung konnte nicht geladen werden.' : null,
  }
}
