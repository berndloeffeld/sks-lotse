import { trackEvent } from '../analytics'
import { apiClient } from '../api/client'
import type { Exam, GradingOutcome } from '../api/types'
import { SUBJECT_GROUP_LABELS } from '../labels'
import { QuestionImages } from './QuestionImages'
import { ReportQuestion } from './ReportQuestion'
import { RichText } from './RichText'
import { SelfAssessment } from './SelfAssessment'

// The self-assessment phase: one question at a time, the learner's own answer
// next to the official one, until every question has an outcome. The grading
// controls (and their keyboard flow) are the same as when practising —
// SelfAssessment, keyed per question.
export function ExamGrading({ exam, onChange }: { exam: Exam; onChange: (exam: Exam) => void }) {
  const graded = exam.questions.filter((q) => q.outcome !== null).length
  const question = exam.questions.find((q) => q.outcome === null)
  if (!question) return null
  const { position } = question

  // Rejects when the grade couldn't be saved — SelfAssessment shows the error.
  async function save(chosen: GradingOutcome) {
    const updated = await apiClient.put<Exam>(`/exams/${exam.id}/questions/${position}/grade`, {
      outcome: chosen,
    })
    if (updated.status === 'completed') trackEvent('exam_completed', { result: updated.result ?? 'unknown' })
    onChange(updated)
  }

  return (
    <article className="flex flex-col gap-4">
      <p className="font-mono text-xs tracking-wide text-ink-soft uppercase">
        {exam.timed_out ? 'Die Zeit ist abgelaufen. ' : ''}Selbsteinschätzung: {graded} von {exam.question_count}{' '}
        bewertet · Frage {question.position} · {SUBJECT_GROUP_LABELS[question.subject_group]}
      </p>
      <p className="font-serif text-base leading-snug whitespace-pre-line text-ink">
        {question.question_text ? <RichText text={question.question_text} /> : 'Diese Frage ist nicht mehr im Katalog.'}
      </p>
      <QuestionImages images={question.question_images} part="question" />
      <section className="rounded-tile border-l-4 border-ink-soft bg-surface p-4">
        <h2 className="text-sm text-ink-soft">Deine Antwort</h2>
        {question.answer_text?.trim() ? (
          <p className="whitespace-pre-line text-ink">{question.answer_text}</p>
        ) : (
          <p className="text-ink-soft italic">Nicht beantwortet.</p>
        )}
      </section>
      <section className="rounded-tile border-l-4 border-primary bg-surface-alt p-4">
        <h2 className="text-sm text-ink-soft">Amtliche Antwort</h2>
        <p className="whitespace-pre-line text-ink">
          {question.official_answer ? (
            <RichText text={question.official_answer} />
          ) : question.official_answer_images.length === 0 ? (
            '—'
          ) : null}
        </p>
        <QuestionImages images={question.official_answer_images} part="answer" />
      </section>
      {question.question_id !== null ? (
        <ReportQuestion key={question.question_id} questionId={question.question_id} />
      ) : null}
      <SelfAssessment
        key={question.position}
        name="exam-outcome"
        layout="column"
        onSave={save}
        saveErrorMessage="Die Bewertung konnte nicht gespeichert werden."
        aiCheck={
          question.official_answer && question.question_id !== null
            ? { questionId: question.question_id, answer: question.answer_text ?? '' }
            : null
        }
      />
    </article>
  )
}
