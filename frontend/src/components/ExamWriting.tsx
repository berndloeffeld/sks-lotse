import { useCallback, useEffect, useRef, useState } from 'react'

import { trackEvent } from '../analytics'
import { ApiError, apiClient } from '../api/client'
import type { Exam } from '../api/types'
import { useExamCountdown } from '../hooks/useExamCountdown'
import { formatCountdown } from '../format'
import { SUBJECT_GROUP_LABELS } from '../labels'
import { CourseGauge } from './CourseGauge'
import { formStyles } from './formStyles'
import { RichText } from './RichText'

const AUTOSAVE_DELAY_MS = 800
const styles = formStyles('light')

interface ExamWritingProps {
  exam: Exam
  // Called with the server's state after a submit, or `null` when the exam
  // must simply be re-read (time ran out, or a save was refused).
  onChange: (exam: Exam | null) => void
}

// The answering phase: one question at a time, then an overview to read
// everything through before handing in. Answers are autosaved and the
// 90-minute countdown is always visible. No tip, no official answer, no grading.
//
// Keyboard: Enter in the answer field moves on (the last question leads to
// the overview), Shift+Enter is a line break, and every new question puts the
// cursor into the answer field.
export function ExamWriting({ exam, onChange }: ExamWritingProps) {
  const [index, setIndex] = useState(0)
  const [view, setView] = useState<'question' | 'overview'>('question')
  const [answers, setAnswers] = useState<Record<number, string>>(() =>
    Object.fromEntries(exam.questions.map((q) => [q.position, q.answer_text ?? ''])),
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmingSubmit, setConfirmingSubmit] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Positions whose latest text hasn't reached the server yet.
  const dirty = useRef(new Set<number>())
  const answersRef = useRef(answers)
  const timer = useRef<number | undefined>(undefined)
  const answerRef = useRef<HTMLTextAreaElement>(null)
  // The parent passes a fresh callback every render; flush must stay stable.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  const remainingMs = useExamCountdown(exam.deadline_at, exam.server_now, () => onChangeRef.current(null))

  // The cursor belongs in the answer field whenever a question comes up.
  useEffect(() => {
    if (view === 'question') answerRef.current?.focus()
  }, [view, index])

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current)
    const positions = [...dirty.current]
    dirty.current.clear()
    for (const position of positions) {
      try {
        await apiClient.put(`/exams/${exam.id}/questions/${position}/answer`, {
          answer_text: answersRef.current[position],
        })
        setSaveError(null)
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          // The exam ended meanwhile — show the server's state.
          onChangeRef.current(null)
          return
        }
        dirty.current.add(position)
        setSaveError('Die Antwort konnte nicht gespeichert werden. Wir versuchen es erneut.')
      }
    }
  }, [exam.id])

  // Retry saves that failed, and never lose the last edit when leaving the page.
  useEffect(() => {
    const retry = window.setInterval(() => {
      if (dirty.current.size > 0) void flush()
    }, 5000)
    return () => {
      window.clearInterval(retry)
      void flush()
    }
  }, [flush])

  function setAnswer(position: number, text: string) {
    answersRef.current = { ...answersRef.current, [position]: text }
    setAnswers(answersRef.current)
    dirty.current.add(position)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), AUTOSAVE_DELAY_MS)
  }

  async function goTo(next: number) {
    setIndex(next)
    setView('question')
    await flush()
  }

  async function showOverview() {
    setView('overview')
    setConfirmingSubmit(false)
    await flush()
  }

  // Enter: on to the next question, or to the overview after the last one.
  function advance() {
    if (index < exam.questions.length - 1) void goTo(index + 1)
    else void showOverview()
  }

  async function submit() {
    setIsSubmitting(true)
    await flush()
    try {
      onChange(await apiClient.post<Exam>(`/exams/${exam.id}/submit`))
      trackEvent('exam_submitted')
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        onChange(null)
        return
      }
      setSaveError('Die Prüfung konnte nicht abgegeben werden. Bitte versuche es erneut.')
      setIsSubmitting(false)
    }
  }

  const question = exam.questions[index]
  const total = exam.questions.length
  const answered = exam.questions.filter((q) => answers[q.position]?.trim()).length
  const lowTime = remainingMs <= 10 * 60 * 1000

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-bg py-3">
        {view === 'question' ? (
          <div className="flex items-center gap-3">
            <CourseGauge
              progress={total > 1 ? index / (total - 1) : 1}
              label={`Frage ${question.position} von ${total}`}
            />
            <p className="font-mono text-sm text-ink">
              Frage {question.position} von {total}
            </p>
          </div>
        ) : (
          <p className="font-mono text-sm text-ink">
            Übersicht: {answered} von {total} beantwortet
          </p>
        )}
        <p
          className={lowTime ? 'font-mono text-sm font-bold text-danger' : 'font-mono text-sm text-ink'}
          role="timer"
          aria-label={`Verbleibende Zeit: ${formatCountdown(remainingMs)} Minuten`}
        >
          {formatCountdown(remainingMs)}
        </p>
      </div>

      {saveError ? (
        <p role="alert" className={styles.error}>
          {saveError}
        </p>
      ) : null}

      {view === 'question' ? (
        <article className="flex flex-col gap-4">
          <p className="font-mono text-xs tracking-wide text-ink-soft uppercase">
            {SUBJECT_GROUP_LABELS[question.subject_group]}
          </p>
          <p className="font-serif text-xl whitespace-pre-line text-ink">
            {question.question_text ? (
              <RichText text={question.question_text} />
            ) : (
              'Diese Frage ist nicht mehr im Katalog.'
            )}
          </p>
          <label className={styles.label} htmlFor="exam-answer">
            Deine Antwort
            <textarea
              id="exam-answer"
              ref={answerRef}
              rows={7}
              maxLength={10000}
              aria-describedby="exam-answer-hint"
              value={answers[question.position] ?? ''}
              onChange={(event) => setAnswer(question.position, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  advance()
                }
              }}
              className={styles.input}
            />
          </label>
          <span id="exam-answer-hint" className="-mt-2 text-xs text-ink-soft">
            Enter: nächste Frage · Shift+Enter: neue Zeile
          </span>
          <div className="flex justify-between gap-4">
            <button type="button" className={styles.button} disabled={index === 0} onClick={() => void goTo(index - 1)}>
              Zurück
            </button>
            <button type="button" className={styles.button} onClick={() => void showOverview()}>
              Übersicht
            </button>
            <button type="button" className={styles.button} onClick={advance}>
              {index === total - 1 ? 'Zur Übersicht' : 'Weiter'}
            </button>
          </div>
        </article>
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            Lies alles noch einmal durch. Mit „Bearbeiten“ springst du zu einer Frage zurück.
            {answered < total ? ` ${total - answered} Fragen sind noch unbeantwortet.` : ''}
          </p>
          <ol className="flex flex-col">
            {exam.questions.map((q, i) => (
              <li key={q.position} className="flex flex-col gap-2 border-b border-border py-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="font-serif text-lg whitespace-pre-line text-ink">
                    <span className="font-mono text-xs text-ink-soft">{q.position}.</span>{' '}
                    {q.question_text ? <RichText text={q.question_text} /> : 'Frage nicht mehr im Katalog'}
                  </p>
                  <button
                    type="button"
                    className={styles.link}
                    aria-label={`Frage ${q.position} bearbeiten`}
                    onClick={() => void goTo(i)}
                  >
                    Bearbeiten
                  </button>
                </div>
                {answers[q.position]?.trim() ? (
                  <p className="pl-4 whitespace-pre-line text-ink">{answers[q.position]}</p>
                ) : (
                  <p className="pl-4 text-ink-soft italic">Nicht beantwortet.</p>
                )}
              </li>
            ))}
          </ol>

          <section className="border-t border-border pt-6">
            {confirmingSubmit ? (
              <div className="flex flex-col gap-3">
                <p className="text-ink">
                  {answered} von {total} Fragen sind beantwortet. Nach der Abgabe kannst du nichts mehr ändern. Jetzt
                  abgeben?
                </p>
                <div className="flex gap-4">
                  <button type="button" className={styles.button} disabled={isSubmitting} onClick={() => void submit()}>
                    {isSubmitting ? 'Wird abgegeben…' : 'Ja, abgeben'}
                  </button>
                  <button
                    type="button"
                    className={styles.link}
                    disabled={isSubmitting}
                    onClick={() => setConfirmingSubmit(false)}
                  >
                    Weiter bearbeiten
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className={styles.button} onClick={() => setConfirmingSubmit(true)}>
                Prüfung abgeben
              </button>
            )}
          </section>
        </>
      )}
    </div>
  )
}
