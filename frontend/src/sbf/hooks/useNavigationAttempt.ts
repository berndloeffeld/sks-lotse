import { useCallback, useState } from 'react'

import { trackEvent } from '../../shared/analytics'
import { apiClient } from '../../shared/api/client'
import { useApiQuery } from '../../shared/hooks/useApiQuery'
import { useAuthStore } from '../../shared/store/authStore'
import type { SbfNavigationAiCheck, SbfNavigationAttempt, SbfNavigationOverview } from '../api/types'

// The learner's runs through the 15 Navigationsaufgaben (ADR-0071), for the overview and the profile.
export function useNavigationOverview() {
  const { data, failed, reload } = useApiQuery('sbf-navigation', () =>
    apiClient.get<SbfNavigationOverview>('/sbf-navigation'),
  )
  return { overview: data ?? null, failed, reload }
}

// The run that's open for this task, or a fresh one: a learner resumes where they left off.
async function openOrStart(task: number): Promise<SbfNavigationAttempt> {
  const overview = await apiClient.get<SbfNavigationOverview>('/sbf-navigation')
  const open = overview.tasks.find((summary) => summary.number === task)?.open_attempt_id
  if (open) return apiClient.get<SbfNavigationAttempt>(`/sbf-navigation/attempts/${open}`)
  return apiClient.post<SbfNavigationAttempt>(`/sbf-navigation/${task}/attempts`)
}

// A saved run through one Navigationsaufgabe. Every write returns the whole run, which replaces the
// loaded one: answering stores the answer (the page shows the official result), the Lotsen-Check adds
// its suggestion (and spends tokens), the point moves on. "Noch einmal" starts a new run.
export function useNavigationAttempt(task: number) {
  const [generation, setGeneration] = useState(0)
  const { data, setData, failed, reload } = useApiQuery(`sbf-attempt:${task}:${generation}`, () => openOrStart(task))
  const id = data?.id

  const answer = useCallback(
    async (subtask: number, answerText: string) => {
      setData(
        await apiClient.put<SbfNavigationAttempt>(`/sbf-navigation/attempts/${id}/subtasks/${subtask}/answer`, {
          answer_text: answerText,
        }),
      )
    },
    [id, setData],
  )

  const grade = useCallback(
    async (subtask: number, correct: boolean) => {
      const updated = await apiClient.put<SbfNavigationAttempt>(
        `/sbf-navigation/attempts/${id}/subtasks/${subtask}/point`,
        { point: correct ? 1 : 0 },
      )
      // Only the last point completes a run, so this fires once per run.
      if (updated.completed_at) trackEvent('navigation_run_completed', { task: updated.task_number })
      setData(updated)
    },
    [id, setData],
  )

  const aiCheck = useCallback(
    async (subtask: number) => {
      const checked = await apiClient.post<SbfNavigationAiCheck>(
        `/sbf-navigation/attempts/${id}/subtasks/${subtask}/ai-check`,
      )
      setData(checked.attempt)
      const { user, setUser } = useAuthStore.getState()
      if (user) setUser({ ...user, token_balance: checked.tokens_remaining })
    },
    [id, setData],
  )

  const restart = useCallback(() => setGeneration((value) => value + 1), [])

  return { attempt: data ?? null, failed, reload, answer, grade, aiCheck, restart }
}
