import { useParams } from 'react-router-dom'

import { apiClient } from '../api/client'
import type { Question, QuestionProgress, Topic } from '../api/types'
import { findTopic, topicQuestions } from '../catalog'
import { PageLayout } from '../components/PageLayout'
import { PracticeRun } from '../components/PracticeRun'
import { TopicQuestionList } from '../components/TopicQuestionList'
import { useApiQuery } from '../hooks/useApiQuery'
import { useCatalog } from '../hooks/useCatalog'
import { useStandingsUpdate } from '../hooks/usePracticeSession'
import { SUBJECT_LABELS } from '../labels'
import { useAuthStore } from '../store/authStore'

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

const NO_QUESTIONS = <p className="text-sm text-ink-soft">Zu diesem Thema gibt es keine Fragen.</p>

// One topic's practice run, open without a login (ADR-0054): guests get the run from the catalog
// export, in catalog order, their gradings only for the round's summary; logged in, the questions, standings and grading come
// from the API as before. Both get every question of the topic below the run (TopicQuestionList).
// A prerendered topic page starts as the guest's and becomes the learner's once the session is known.
export function PracticePage() {
  const { subject = '', topic: topicSlug = '' } = useParams()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? (
    <MemberPractice subject={subject} topicSlug={topicSlug} />
  ) : (
    <GuestPractice subject={subject} topicSlug={topicSlug} />
  )
}

interface TopicProps {
  subject: string
  topicSlug: string
}

function GuestPractice({ subject, topicSlug }: TopicProps) {
  const { catalog, failed } = useCatalog()
  const topic = catalog ? findTopic(catalog, subject, topicSlug) : undefined
  const questions = catalog ? topicQuestions(catalog, subject, topicSlug) : []

  return (
    <PageLayout title={topic?.name ?? 'Lernen'} subtitle={SUBJECT_LABELS[subject] ?? subject} nav="public" compact>
      {failed ? (
        <p className="text-sm text-danger">Die Fragen konnten nicht geladen werden.</p>
      ) : !catalog ? (
        <p className="text-sm text-ink-soft">Fragen werden geladen…</p>
      ) : questions.length === 0 ? (
        NO_QUESTIONS
      ) : (
        <>
          <PracticeRun
            key={`${subject}/${topicSlug}`}
            questions={questions}
            standings={NO_STANDINGS}
            onGraded={ignoreGrade}
            keepOrder
            guest
          />
          <TopicQuestionList questions={questions} />
        </>
      )}
    </PageLayout>
  )
}

const NO_STANDINGS = new Map<number, QuestionProgress>()
const ignoreGrade = () => {}

function MemberPractice({ subject, topicSlug }: TopicProps) {
  const { data, setData, isLoading, error } = usePracticeData(subject, topicSlug)

  const onGraded = useStandingsUpdate(setData)

  return (
    <PageLayout
      title={data?.topic?.name ?? 'Lernen'}
      subtitle={SUBJECT_LABELS[subject] ?? subject}
      nav="public"
      compact
      immersive
    >
      {isLoading ? (
        <p className="text-sm text-ink-soft">Fragen werden geladen…</p>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : !data || data.questions.length === 0 ? (
        NO_QUESTIONS
      ) : (
        <>
          <PracticeRun
            key={`${subject}/${topicSlug}`}
            questions={data.questions}
            standings={data.standings}
            onGraded={onGraded}
          />
          <TopicQuestionList questions={data.questions} />
        </>
      )}
    </PageLayout>
  )
}
