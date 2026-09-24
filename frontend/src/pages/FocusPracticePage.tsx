import { useCallback } from 'react'

import { trackEvent } from '../analytics'
import { apiClient } from '../api/client'
import type { Question, QuestionProgress, TopicProgress } from '../api/types'
import { PageLayout } from '../components/PageLayout'
import { PracticeRun } from '../components/PracticeRun'
import { useApiQuery } from '../hooks/useApiQuery'
import { SUBJECT_LABELS } from '../labels'

interface FocusData {
  questions: Question[]
  standings: Map<number, QuestionProgress>
  topics: TopicProgress[]
}

// The Fokus session: the open questions of all Fokus topics, oldest correct
// answer first regardless of topic (ADR-0028). The server orders and filters;
// the list is fetched once, so the run stays as it was when it started.
export function FocusPracticePage() {
  const { data, setData, isLoading, failed } = useApiQuery<FocusData>('focus-session', async () => {
    const [questions, progress, topics] = await Promise.all([
      apiClient.get<Question[]>('/progress/focus/questions'),
      apiClient.get<QuestionProgress[]>('/progress/questions'),
      apiClient.get<TopicProgress[]>('/progress/summary'),
    ])
    trackEvent('focus_session_start')
    return { questions, standings: new Map(progress.map((p) => [p.question_id, p])), topics }
  })

  const onGraded = useCallback(
    (result: QuestionProgress) =>
      setData((current) => ({ ...current, standings: new Map(current.standings).set(result.question_id, result) })),
    [setData],
  )

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

  return (
    <PageLayout
      title="Fokus-Lernen"
      subtitle="Alle Fokus-Themen, die älteste richtige Antwort zuerst"
      backTo="/learn"
      compact
    >
      {isLoading ? (
        <p className="text-sm text-ink-soft">Fragen werden geladen…</p>
      ) : failed || !data ? (
        <p className="text-sm text-danger">Die Fragen konnten nicht geladen werden.</p>
      ) : (
        <PracticeRun
          questions={data.questions}
          standings={data.standings}
          onGraded={onGraded}
          keepOrder
          contextLabel={contextLabel}
        />
      )}
    </PageLayout>
  )
}
