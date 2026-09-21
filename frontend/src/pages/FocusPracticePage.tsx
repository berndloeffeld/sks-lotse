import { useCallback, useEffect, useState } from 'react'

import { trackEvent } from '../analytics'
import { apiClient } from '../api/client'
import type { Question, QuestionProgress, TopicProgress } from '../api/types'
import { PageLayout } from '../components/PageLayout'
import { SUBJECT_LABELS } from '../hooks/useProgressSummary'
import { PracticeRun } from './PracticePage'

// The Fokus session: the open questions of all Fokus topics, oldest correct
// answer first regardless of topic (ADR-0028). The server orders and filters;
// the list is fetched once, so the run stays as it was when it started.
export function FocusPracticePage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [standings, setStandings] = useState<Map<number, QuestionProgress>>(new Map())
  const [topics, setTopics] = useState<TopicProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [questionData, progressData, topicData] = await Promise.all([
          apiClient.get<Question[]>('/progress/focus/questions'),
          apiClient.get<QuestionProgress[]>('/progress/questions'),
          apiClient.get<TopicProgress[]>('/progress/summary'),
        ])
        setQuestions(questionData)
        setStandings(new Map(progressData.map((p) => [p.question_id, p])))
        setTopics(topicData)
        trackEvent('focus_session_start')
      } catch {
        setError('Die Fragen konnten nicht geladen werden.')
      } finally {
        setIsLoading(false)
      }
    }
    // Same fetch-on-mount pattern as usePracticeData.
    void load()
  }, [])

  const onGraded = useCallback(
    (result: QuestionProgress) => setStandings((current) => new Map(current).set(result.question_id, result)),
    [],
  )

  // A question only knows its subject and topic slug; the name comes from the summary.
  const contextLabel = useCallback(
    (question: Question) => {
      const topic = topics.find((t) => t.subject === question.subject && t.topic_slug === question.topic)
      return `${SUBJECT_LABELS[question.subject] ?? question.subject}: ${topic?.topic_name ?? question.topic ?? ''}`
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
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : (
        <PracticeRun
          questions={questions}
          standings={standings}
          onGraded={onGraded}
          keepOrder
          contextLabel={contextLabel}
        />
      )}
    </PageLayout>
  )
}
