import { useCallback } from 'react'

import { apiClient } from '../api/client'
import type { ChartAiCheck, ChartAttempt, ChartExercisesOverview } from '../api/types'
import { useAuthStore } from '../store/authStore'
import { useApiQuery } from './useApiQuery'

// The ten Kartenaufgaben with the learner's runs, plus what every sheet shares (hints, tide form).
export function useChartOverview() {
  const { data, failed, reload } = useApiQuery('chart-exercises', () =>
    apiClient.get<ChartExercisesOverview>('/chart-exercises'),
  )
  return {
    overview: data ?? null,
    reload,
    error: failed ? 'Die Kartenaufgaben konnten nicht geladen werden.' : null,
  }
}

// One run through a Kartenaufgabe. Every write returns the whole run, which replaces the loaded one:
// answering reveals the task's solution, the Lotsen-Check adds its suggestion (and spends tokens),
// giving points moves on to the next task.
export function useChartAttempt(id: string | undefined) {
  const { data, setData, isLoading, failed } = useApiQuery(`chart-attempt:${id}`, () =>
    apiClient.get<ChartAttempt>(`/chart-exercises/attempts/${id}`),
  )

  const answer = useCallback(
    async (task: number, answerText: string) => {
      setData(
        await apiClient.put<ChartAttempt>(`/chart-exercises/attempts/${id}/tasks/${task}/answer`, {
          answer_text: answerText,
        }),
      )
    },
    [id, setData],
  )

  const awardPoints = useCallback(
    async (task: number, points: number) => {
      setData(await apiClient.put<ChartAttempt>(`/chart-exercises/attempts/${id}/tasks/${task}/points`, { points }))
    },
    [id, setData],
  )

  const aiCheck = useCallback(
    async (task: number) => {
      const checked = await apiClient.post<ChartAiCheck>(`/chart-exercises/attempts/${id}/tasks/${task}/ai-check`)
      setData(checked.attempt)
      const { user, setUser } = useAuthStore.getState()
      if (user) setUser({ ...user, token_balance: checked.tokens_remaining })
    },
    [id, setData],
  )

  return {
    attempt: data ?? null,
    isLoading,
    error: failed ? 'Die Kartenaufgabe konnte nicht geladen werden.' : null,
    answer,
    awardPoints,
    aiCheck,
  }
}
