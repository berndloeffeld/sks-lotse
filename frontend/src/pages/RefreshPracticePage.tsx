import { useCallback } from 'react'

import { trackEvent } from '../analytics'
import { apiClient } from '../api/client'
import type { Question, QuestionProgress, TopicProgress } from '../api/types'
import { PageLayout } from '../components/PageLayout'
import { PracticeRun } from '../components/PracticeRun'
import { useApiQuery } from '../hooks/useApiQuery'
import { SUBJECT_LABELS } from '../labels'

interface RefreshData {
  questions: Question[]
  standings: Map<number, QuestionProgress>
  topics: TopicProgress[]
}

const EMPTY_STATE = {
  title: 'Nichts aufzufrischen',
  text: 'Gerade droht keine deiner sicher gelernten Fragen zu verblassen. Komm in ein paar Tagen wieder.',
}

// The Auffrischen session: a random sample of questions that were gelernt and have lapsed or
// are about to (ADR-0049). The server picks them; the list is fetched once, so the run stays as
// it was when it started.
export function RefreshPracticePage() {
  const { data, setData, isLoading, failed } = useApiQuery<RefreshData>('refresh-session', async () => {
    const [questions, progress, topics] = await Promise.all([
      apiClient.get<Question[]>('/progress/refresh/questions'),
      apiClient.get<QuestionProgress[]>('/progress/questions'),
      apiClient.get<TopicProgress[]>('/progress/summary'),
    ])
    trackEvent('refresh_session_start')
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
      title="Auffrischen"
      subtitle="Sicher gelernte Fragen, die möglicherweise verblasst sind oder bald verblassen könnten"
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
          keepLearned
          emptyState={EMPTY_STATE}
          contextLabel={contextLabel}
        />
      )}
    </PageLayout>
  )
}
