import { useCallback } from 'react'
import { useParams } from 'react-router-dom'

import { apiClient } from '../api/client'
import type { Question, QuestionProgress, Topic } from '../api/types'
import { PageLayout } from '../components/PageLayout'
import { PracticeRun } from '../components/PracticeRun'
import { useApiQuery } from '../hooks/useApiQuery'
import { SUBJECT_LABELS } from '../labels'

interface PracticeData {
  questions: Question[]
  standings: Map<number, QuestionProgress>
  topic: Topic | null
}

// Loads the topic's questions, the learner's per-question standings and the
// topic's display name, in parallel — again when the route moves to another topic.
function usePracticeData(subject: string, topicSlug: string) {
  const { data, setData, isLoading, failed } = useApiQuery<PracticeData>(`${subject}/${topicSlug}`, async () => {
    const query = `subject=${encodeURIComponent(subject)}`
    const [questions, progress, topics] = await Promise.all([
      apiClient.get<Question[]>(`/questions?${query}&topic=${encodeURIComponent(topicSlug)}`),
      apiClient.get<QuestionProgress[]>('/progress/questions'),
      apiClient.get<Topic[]>(`/topics?${query}`),
    ])
    return {
      questions,
      standings: new Map(progress.map((p) => [p.question_id, p])),
      topic: topics.find((t) => t.slug === topicSlug) ?? null,
    }
  })
  return { data, setData, isLoading, error: failed ? 'Die Fragen konnten nicht geladen werden.' : null }
}

export function PracticePage() {
  const { subject = '', topic: topicSlug = '' } = useParams()
  const { data, setData, isLoading, error } = usePracticeData(subject, topicSlug)

  const onGraded = useCallback(
    (result: QuestionProgress) =>
      setData((current) => ({ ...current, standings: new Map(current.standings).set(result.question_id, result) })),
    [setData],
  )

  return (
    <PageLayout title={data?.topic?.name ?? 'Lernen'} subtitle={SUBJECT_LABELS[subject] ?? subject} compact>
      {isLoading ? (
        <p className="text-sm text-ink-soft">Fragen werden geladen…</p>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : !data || data.questions.length === 0 ? (
        <p className="text-sm text-ink-soft">Zu diesem Thema gibt es keine Fragen.</p>
      ) : (
        <PracticeRun
          key={`${subject}/${topicSlug}`}
          questions={data.questions}
          standings={data.standings}
          onGraded={onGraded}
        />
      )}
    </PageLayout>
  )
}
