import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

import { trackEvent } from '../analytics'
import { apiClient } from '../api/client'
import type { Exam, GradingOutcome } from '../api/types'
import { OUTCOME_LABELS, SUBJECT_GROUP_LABELS } from '../labels'
import { scrollBelowIntoView } from '../scroll'
import { AiAnswerCheck } from './AiAnswerCheck'
import { formStyles } from './formStyles'
import { ReportQuestion } from './ReportQuestion'
import { QuestionImages } from './QuestionImages'
import { RichText } from './RichText'

const OUTCOMES = Object.keys(OUTCOME_LABELS) as GradingOutcome[]
const styles = formStyles('light')

// The self-assessment phase: one question at a time, the learner's own answer
// next to the official one, until every question has an outcome. Stands in for
// the LLM grading that doesn't exist yet.
//
// Keyboard (same as when practising): each new question puts focus on the
// group *before* the options, so Tab lands on "Richtig" and keeps cycling
// Richtig → Teilweise Richtig → Falsch → Richtig without selecting anything;
// Enter on an option saves that assessment.
export function ExamGrading({ exam, onChange }: { exam: Exam; onChange: (exam: Exam) => void }) {
  const [outcome, setOutcome] = useState<GradingOutcome | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const groupRef = useRef<HTMLFieldSetElement>(null)
  const askRef = useRef<HTMLButtonElement>(null)
  const radioRefs = useRef<(HTMLInputElement | null)[]>([])
  const continueRef = useRef<HTMLButtonElement>(null)

  const graded = exam.questions.filter((q) => q.outcome !== null).length
  const question = exam.questions.find((q) => q.outcome === null)
  const position = question?.position

  // A new question shows everything at once (answer, official answer, Lotse row), which can
  // already overflow a short viewport, so scroll down until "Weiter" clears the fold too.
  useEffect(() => {
    if (position !== undefined) {
      scrollBelowIntoView(continueRef.current)
      groupRef.current?.focus({ preventScroll: true })
    }
  }, [position])

  if (!question) return null

  // Tab cycles through the grade radios and, when usable, the Lotse row (focus only, no selection).
  function cycleFocus(from: HTMLElement, backwards: boolean) {
    const stops = [...radioRefs.current, askRef.current].filter(
      (el): el is HTMLInputElement | HTMLButtonElement => el !== null && !el.disabled,
    )
    const at = stops.indexOf(from as HTMLInputElement | HTMLButtonElement)
    stops[(at + (backwards ? stops.length - 1 : 1)) % stops.length]?.focus()
  }

  // The AI check only *suggests*: preselect its grade and put focus on it, so Enter confirms
  // and Tab keeps cycling through the radios like in the manual loop. Its suggestion box can
  // push "Weiter" further down than the question-change scroll reached, so scroll again.
  function suggestOutcome(suggested: GradingOutcome) {
    flushSync(() => setOutcome(suggested))
    radioRefs.current[OUTCOMES.indexOf(suggested)]?.focus({ preventScroll: true })
    scrollBelowIntoView(continueRef.current)
  }

  async function save(chosen: GradingOutcome | null) {
    if (!chosen || !question || isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      const updated = await apiClient.put<Exam>(`/exams/${exam.id}/questions/${question.position}/grade`, {
        outcome: chosen,
      })
      if (updated.status === 'completed') trackEvent('exam_completed', { result: updated.result ?? 'unknown' })
      onChange(updated)
      setOutcome(null)
    } catch {
      setError('Die Bewertung konnte nicht gespeichert werden.')
    } finally {
      setIsSaving(false)
    }
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
      <fieldset ref={groupRef} tabIndex={-1} className="flex flex-col gap-2 outline-none" disabled={isSaving}>
        <legend className="mb-2 text-sm text-ink-soft">Wie gut war deine Antwort?</legend>
        {OUTCOMES.map((o, i) => (
          <label key={o} className="flex items-center gap-2 text-ink">
            <input
              ref={(el) => {
                radioRefs.current[i] = el
              }}
              type="radio"
              name="exam-outcome"
              value={o}
              checked={outcome === o}
              onChange={() => setOutcome(o)}
              onKeyDown={(event) => {
                if (event.key === 'Tab') {
                  event.preventDefault()
                  cycleFocus(event.currentTarget, event.shiftKey)
                } else if (event.key === 'Enter') {
                  event.preventDefault()
                  setOutcome(o)
                  void save(o)
                }
              }}
              className="accent-primary"
            />
            {OUTCOME_LABELS[o]}
          </label>
        ))}
      </fieldset>
      {question.official_answer && question.question_id !== null ? (
        <AiAnswerCheck
          key={question.question_id}
          questionId={question.question_id}
          answer={question.answer_text ?? ''}
          onSuggest={suggestOutcome}
          buttonRef={askRef}
          onButtonKeyDown={(event) => {
            if (event.key === 'Tab') {
              event.preventDefault()
              cycleFocus(event.currentTarget, event.shiftKey)
            }
          }}
        />
      ) : null}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <button
        ref={continueRef}
        type="button"
        className={styles.button}
        disabled={!outcome || isSaving}
        onClick={() => void save(outcome)}
      >
        {isSaving ? 'Wird gespeichert…' : 'Weiter'}
      </button>
    </article>
  )
}
