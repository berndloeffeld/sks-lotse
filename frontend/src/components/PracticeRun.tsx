import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { trackEvent } from '../analytics'
import { apiClient } from '../api/client'
import type { GradingOutcome, Question, QuestionProgress } from '../api/types'
import { OUTCOME_LABELS } from '../labels'
import { CourseGauge } from './CourseGauge'
import { formStyles } from './formStyles'
import { CELEBRATION_MS, LearnedCelebration } from './LearnedCelebration'
import { QuestionImages } from './QuestionImages'
import { ReportQuestion } from './ReportQuestion'
import { RichText } from './RichText'
import { SelfAssessment } from './SelfAssessment'

type Phase = 'answer' | 'assess'

const OUTCOMES = Object.keys(OUTCOME_LABELS) as GradingOutcome[]

function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// A run is the topic's not-yet-learned questions in random order, or — once
// everything is learned and the learner asks for it — all of them. A question
// that was learned but has been forgotten meanwhile (server-side) counts as not learned.
// The Fokus session (`keepOrder`) arrives ordered by the server and stays that way.
function buildRun(
  questions: Question[],
  standings: Map<number, QuestionProgress>,
  includeLearned: boolean,
  keepOrder: boolean,
): Question[] {
  const pool = includeLearned ? questions : questions.filter((q) => !standings.get(q.id)?.learned)
  return keepOrder ? pool : shuffled(pool)
}

// How long the boat gets to sail to its new position before the next question.
const BOAT_SETTLE_MS = 1500

// Nothing sails under reduced motion, so there is nothing to wait for.
function letBoatSettle(ms = BOAT_SETTLE_MS): Promise<void> {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface PracticeRunProps {
  questions: Question[]
  standings: Map<number, QuestionProgress>
  onGraded: (result: QuestionProgress) => void
  // Fokus session: play the questions in the given order, and say which topic each one is from.
  keepOrder?: boolean
  contextLabel?: (question: Question) => string
}

// The learning loop for one run (ADR-0023): read the question, optionally
// jot down an answer, reveal the official answer, assess yourself —
// Richtig / Teilweise Richtig / Falsch — and watch the boat move (CourseGauge).
export function PracticeRun({ questions, standings, onGraded, keepOrder = false, contextLabel }: PracticeRunProps) {
  const [run, setRun] = useState(() => buildRun(questions, standings, false, keepOrder))
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('answer')
  const [note, setNote] = useState('')
  const [tally, setTally] = useState<GradingOutcome[]>([])
  const [newlyLearned, setNewlyLearned] = useState(0)
  const [feedback, setFeedback] = useState('')
  // Number of the question that just became gelernt, while its celebration runs.
  const [celebrating, setCelebrating] = useState<number | null>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const styles = formStyles('light')

  // Keyboard flow: each phase hands focus to the control the learner needs next, so the whole
  // loop works without a mouse — the answer field here, the grade group once SelfAssessment mounts.
  // A layout effect, so the question never shows up without the cursor in the field.
  useLayoutEffect(() => {
    if (phase === 'answer') noteRef.current?.focus()
  }, [phase, index, run])

  const startRun = (includeLearned: boolean) => {
    setRun(buildRun(questions, standings, includeLearned, keepOrder))
    setIndex(0)
    setPhase('answer')
    setNote('')
    setTally([])
    setNewlyLearned(0)
  }

  const nextQuestion = () => {
    setIndex((i) => i + 1)
    setPhase('answer')
    setNote('')
  }

  const question = run[index] as Question | undefined

  // Rejects when the grading couldn't be saved — SelfAssessment shows the error and keeps the choice.
  const saveGrade = async (chosen: GradingOutcome) => {
    if (!question) return
    const result = await apiClient.post<QuestionProgress>(`/progress/questions/${question.id}`, { outcome: chosen })
    const learnedNow = result.learned && !standings.get(question.id)?.learned
    trackEvent('question_graded', { outcome: chosen })
    if (learnedNow) {
      trackEvent('question_learned')
      setNewlyLearned((n) => n + 1)
      setCelebrating(question.number)
    }
    onGraded(result)
    setTally((t) => [...t, chosen])
    // The result is announced to screen readers; sighted learners see the
    // boat sail to the new status before the next question comes up.
    setFeedback(
      result.learned
        ? 'Gelernt.'
        : chosen === 'richtig'
          ? 'Richtig – ein Stück näher am Ziel.'
          : 'Zurückgefallen – die Frage kommt später wieder.',
    )
    await letBoatSettle(learnedNow ? CELEBRATION_MS : BOAT_SETTLE_MS)
    setCelebrating(null)
    nextQuestion()
  }

  if (run.length === 0) {
    return (
      <section className="flex flex-col items-start gap-4">
        <h2 className="font-serif text-2xl text-primary">Alles gelernt</h2>
        <p className="text-sm text-ink-soft">
          {keepOrder ? 'Es sind keine Fokus-Fragen offen.' : 'Du hast jede Frage dieses Themas gelernt.'}
        </p>
        <div className="flex flex-wrap gap-3">
          {keepOrder ? null : (
            <button
              type="button"
              className="rounded-tile border border-primary px-4 py-3 font-mono text-sm tracking-wide text-primary uppercase transition hover:bg-primary hover:text-surface"
              onClick={() => startRun(true)}
            >
              Alle Fragen wiederholen
            </button>
          )}
          <Link to="/learn" className={styles.button}>
            Zur Themenübersicht
          </Link>
        </div>
      </section>
    )
  }

  if (!question) {
    const count = (o: GradingOutcome) => tally.filter((t) => t === o).length
    return (
      <section className="flex flex-col items-start gap-4">
        <p role="status" className="sr-only">
          {feedback}
        </p>
        <h2 className="font-serif text-2xl text-primary">Runde beendet</h2>
        <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 font-mono text-sm">
          {OUTCOMES.map((o) => (
            <div key={o} className="contents">
              <dt className="text-ink-soft">{OUTCOME_LABELS[o]}</dt>
              <dd className="text-ink">{count(o)}</dd>
            </div>
          ))}
          <dt className="text-ink-soft">Neu gelernt</dt>
          <dd className="text-ink">{newlyLearned}</dd>
        </dl>
        <Link to="/learn" className={styles.button}>
          Zur Themenübersicht
        </Link>
      </section>
    )
  }

  return (
    <article className="flex flex-col gap-4">
      <p role="status" className="sr-only">
        {feedback}
      </p>
      {celebrating !== null ? <LearnedCelebration questionNumber={celebrating} /> : null}
      <div className="relative flex items-center justify-between gap-4 border-b border-border pb-3">
        {/* Where the learner is in this run (the boxed count) is set apart from which question this
            is (number and topic), so the two never read as one string. */}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs tracking-wide text-ink-soft uppercase">
          <span className="sr-only">
            Frage {index + 1} von {run.length}
          </span>
          <span aria-hidden="true" className="rounded-tile border border-primary px-2 py-0.5 text-primary">
            {index + 1} / {run.length}
          </span>
          <span>
            {contextLabel ? `${contextLabel(question)} – ` : ''}Nr. {question.number}
          </span>
        </p>
        {/* Keyed per question (one key on the wrapper — duplicate sibling keys make React leave the
            previous question's gauge standing): a new question starts where it stands, only a
            grading of this one makes the boat sail, and the report popover starts closed. */}
        <div key={question.id} className="flex items-center gap-3">
          <CourseGauge progress={standings.get(question.id)?.progress ?? 0} />
          <ReportQuestion questionId={question.id} />
        </div>
      </div>

      <h2 className="font-serif text-base leading-snug whitespace-pre-line text-ink outline-none">
        <RichText text={question.question_text} />
      </h2>
      <QuestionImages images={question.question_images} part="question" />

      {phase === 'answer' ? (
        <>
          <label className={styles.label}>
            Deine Antwort
            <textarea
              ref={noteRef}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  setPhase('assess')
                }
              }}
              rows={4}
              className={styles.input}
            />
            <span className="text-xs text-ink-soft">Enter: Lösung anzeigen · Shift+Enter: neue Zeile</span>
          </label>
          <button type="button" className={styles.button} onClick={() => setPhase('assess')}>
            Lösung anzeigen
          </button>
        </>
      ) : (
        <>
          {note.trim() ? (
            <section className="flex flex-col gap-1 rounded-tile border-l-4 border-ink-soft bg-surface px-3 py-2">
              <h3 className="font-mono text-xs tracking-wide text-ink-soft uppercase">Deine Antwort</h3>
              <p className="text-sm whitespace-pre-line text-ink-soft">{note}</p>
            </section>
          ) : null}
          <section className="flex flex-col gap-1 rounded-tile border-l-4 border-primary bg-surface-alt px-3 py-2">
            <h3 className="font-mono text-xs tracking-wide text-ink-soft uppercase">Amtliche Antwort</h3>
            {question.answer_text ? (
              <p className="text-sm whitespace-pre-line text-ink">
                <RichText text={question.answer_text} />
              </p>
            ) : question.answer_images.length === 0 ? (
              // A few official answers are only a sketch in the catalog PDF, with no text at all;
              // their sketch is an answer image, so this is only reached if that image is missing.
              <p className="text-ink-soft italic">
                Die amtliche Antwort zu dieser Frage besteht nur aus einer Skizze, die SKS Lotse nicht anzeigen kann.
              </p>
            ) : null}
            <QuestionImages images={question.answer_images} part="answer" />
          </section>

          <SelfAssessment
            key={question.id}
            name="outcome"
            layout="row"
            onSave={saveGrade}
            saveErrorMessage="Die Bewertung konnte nicht gespeichert werden. Bitte versuche es erneut."
            aiCheck={question.answer_text ? { questionId: question.id, answer: note } : null}
          />
        </>
      )}
    </article>
  )
}
