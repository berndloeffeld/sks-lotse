import { useCallback } from 'react'

import { trackEvent } from '../analytics'
import { apiClient } from '../api/client'
import type { Question, QuestionProgress, TopicProgress } from '../api/types'
import { SUBJECT_LABELS } from '../labels'
import { useApiQuery } from './useApiQuery'

interface PracticeSession {
  questions: Question[]
  standings: Map<number, QuestionProgress>
  topics: TopicProgress[]
}

// Folds a graded question into the standings a run shows, for any data that carries them.
export function useStandingsUpdate<D extends { standings: Map<number, QuestionProgress> }>(
  setData: (update: (current: D) => D) => void,
) {
  return useCallback(
    (result: QuestionProgress) =>
      setData((current) => ({ ...current, standings: new Map(current.standings).set(result.question_id, result) })),
    [setData],
  )
}

// A session the server compiles (Fokus, Auffrischen): its questions from `questionsPath`, the
// learner's standings and the topic names. Fetched once, so the run stays as it was when it
// started; `startEvent` is tracked when the data arrived.
export function usePracticeSession(key: string, questionsPath: string, startEvent: string) {
  const { data, setData, isLoading, failed, reload } = useApiQuery<PracticeSession>(key, async () => {
    const [questions, progress, topics] = await Promise.all([
      apiClient.get<Question[]>(questionsPath),
      apiClient.get<QuestionProgress[]>('/progress/questions'),
      apiClient.get<TopicProgress[]>('/progress/summary'),
    ])
    trackEvent(startEvent)
    return { questions, standings: new Map(progress.map((p) => [p.question_id, p])), topics }
  })

  const onGraded = useStandingsUpdate(setData)

  // A question only knows its subject and topic slug; the name comes from the summary.
  const topics = data?.topics
  const contextLabel = useCallback(
    (question: Question) => {
      const topic = topics?.find((t) => t.subject === question.subject && t.topic_slug === question.topic)
      const subject = SUBJECT_LABELS[question.subject] ?? question.subject
      const topicName = topic?.topic_name ?? question.topic
      return topicName ? `${subject} (${topicName})` : subject
    },
    [topics],
  )

  return { data, isLoading, failed, reload, onGraded, contextLabel }
}
