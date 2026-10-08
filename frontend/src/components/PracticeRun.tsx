import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { trackEvent } from '../analytics'
import { apiClient } from '../api/client'
import type { GradingOutcome, Question, QuestionProgress } from '../api/types'
import { GRADING_OUTCOMES as OUTCOMES, OUTCOME_LABELS } from '../labels'
import { OfficialAnswerBox, OwnAnswer } from './AnswerBox'
import { CourseGauge } from './CourseGauge'
import { useEnterShortcut } from '../hooks/useEnterShortcut'
import { formStyles } from './formStyles'
import { CELEBRATION_MS, LearnedCelebration } from './LearnedCelebration'
import { GuestCta, LoginLink } from './LoginLink'
import { QuestionImages } from './QuestionImages'
import { ReportQuestion } from './ReportQuestion'
import { RichText } from './RichText'
import { SelfAssessment } from './SelfAssessment'
import { buttonClass } from './buttonStyles'
import { sectionHeading } from './headingStyles'

type Phase = 'answer' | 'assess'

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
// The Auffrischen session (`keepLearned`) is made of questions the server picked because they
// are about to lapse — many are still gelernt, so nothing is filtered out.
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

// Where a run leads back to: the tab of /learn it was started from.
export interface RunExit {
  to: string
  label: string
}

const TOPIC_EXIT: RunExit = { to: '/learn', label: 'Zur Themenübersicht' }

interface PracticeRunProps {
  questions: Question[]
  standings: Map<number, QuestionProgress>
  onGraded: (result: QuestionProgress) => void
  // Fokus session: play the questions in the given order, and say which topic each one is from.
  keepOrder?: boolean
  contextLabel?: (question: Question) => string
  // Auffrischen session: play the questions as given, learned or not.
  keepLearned?: boolean
  // What to say when the run is empty; the default is the topic run's "everything learned".
  emptyState?: { title: string; text: string }
  // The way back, from the run's header ("Runde beenden"), its end and its empty state; the topic
  // list by default.
  exit?: RunExit
  // Without a login (ADR-0054): in catalog order, and the self-assessment only counts for this
  // round's summary; nothing is stored or sent — the Lotsen-Check only as a teaser, no report, no gauge.
  guest?: boolean
}

// The learning loop for one run (ADR-0023): read the question, optionally
// jot down an answer, reveal the official answer, assess yourself —
// Richtig / Teilweise richtig / Falsch — and watch the boat move (CourseGauge).
export function PracticeRun({
  questions,
  standings,
  onGraded,
  keepOrder = false,
  contextLabel,
  keepLearned = false,
  emptyState,
  exit = TOPIC_EXIT,
  guest = false,
}: PracticeRunProps) {
  const [run, setRun] = useState(() => buildRun(questions, standings, keepLearned, keepOrder))
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('answer')
  const [note, setNote] = useState('')
  const [tally, setTally] = useState<GradingOutcome[]>([])
  const [newlyLearned, setNewlyLearned] = useState(0)
  const [feedback, setFeedback] = useState('')
  // Whether a question just became gelernt, while its celebration runs.
  const [celebrating, setCelebrating] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const enterShortcut = useEnterShortcut(() => setPhase('assess'))
  const styles = formStyles('light')

  // Keyboard flow: each phase hands focus to the control the learner needs next, so the whole
  // loop works without a mouse — the answer field here, the grade group once SelfAssessment mounts.
  // A layout effect, so the question never shows up without the cursor in the field.
  // A guest arriving on the page (often from a search) isn't pulled into the field before they
  // chose to start; from the second question on, the loop is the same.
  useLayoutEffect(() => {
    if (phase === 'answer' && !(guest && index === 0)) noteRef.current?.focus()
  }, [phase, index, run, guest])

  const startRun = (includeLearned: boolean) => {
    setRun(buildRun(questions, standings, includeLearned || keepLearned, keepOrder))
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

  // A guest's grading only counts for the summary, and the next question follows at once (no boat).
  const saveGuestGrade = async (chosen: GradingOutcome) => {
    if (!question) return
    setTally((t) => [...t, chosen])
    nextQuestion()
  }

  // Rejects when the grading couldn't be saved — SelfAssessment shows the error and keeps the choice.
  const saveGrade = async (chosen: GradingOutcome) => {
    if (!question) return
    const result = await apiClient.post<QuestionProgress>(`/progress/questions/${question.id}`, { outcome: chosen })
    const learnedNow = result.learned && !standings.get(question.id)?.learned
    trackEvent('question_graded', { outcome: chosen })
    if (learnedNow) {
      trackEvent('question_learned')
      setNewlyLearned((n) => n + 1)
      setCelebrating(true)
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
    setCelebrating(false)
    nextQuestion()
  }

  if (run.length === 0) {
    return (
      <section className="flex flex-col items-start gap-4">
        <h2 className={sectionHeading}>{emptyState?.title ?? 'Alles gelernt'}</h2>
        <p className="text-sm text-ink-soft">
          {emptyState?.text ??
            (keepOrder ? 'Es sind keine Fokus-Fragen offen.' : 'Du hast jede Frage dieses Themas gelernt.')}
        </p>
        <div className="flex flex-wrap gap-3">
          {keepOrder || keepLearned ? null : (
            <button type="button" className={buttonClass('secondary')} onClick={() => startRun(true)}>
              Alle Fragen wiederholen
            </button>
          )}
          <Link to={exit.to} className={buttonClass('primary')}>
            {exit.label}
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
        <h2 className={sectionHeading}>Runde beendet</h2>
        <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 font-mono text-sm">
          {OUTCOMES.map((o) => (
            <div key={o} className="contents">
              <dt className="text-ink-soft">{OUTCOME_LABELS[o]}</dt>
              <dd className="text-ink">{count(o)}</dd>
            </div>
          ))}
          {guest ? null : (
            <>
              <dt className="text-ink-soft">Neu gelernt</dt>
              <dd className="text-ink">{newlyLearned}</dd>
            </>
          )}
        </dl>
        {guest ? (
          <GuestCta>
            Ohne Anmeldung wird nichts gespeichert. Mit Anmeldung merkt sich SKS Lotse, was du sicher kannst, holt
            Verblasstes zurück und zeigt deinen Lernstand auf jedem Gerät.
          </GuestCta>
        ) : null}
        <Link to={exit.to} className={buttonClass('primary')}>
          {exit.label}
        </Link>
      </section>
    )
  }

  return (
    <article className="flex flex-col gap-4">
      <p role="status" className="sr-only">
        {feedback}
      </p>
      {celebrating ? <LearnedCelebration /> : null}
      <div className="relative flex items-center justify-between gap-4 border-b border-border pb-3">
        {/* Where the learner is in this run (the boxed count) sits above the line; which question
            this is (topic and number) sits below it, on a line without the gauge and report button,
            so a long topic wraps cleanly instead of fighting them for space. */}
        <p className="font-mono text-xs tracking-wide text-ink-soft uppercase">
          <span className="sr-only">
            Frage {index + 1} von {run.length}
          </span>
          <span aria-hidden="true" className="rounded-tile border border-primary px-2 py-0.5 text-primary">
            {index + 1} / {run.length}
          </span>
        </p>
        {/* Keyed per question (one key on the wrapper — duplicate sibling keys make React leave the
            previous question's gauge standing): a new question starts where it stands, only a
            grading of this one makes the boat sail, and the report popover starts closed. */}
        {guest ? null : (
          <div key={question.id} className="flex items-center gap-3">
            <CourseGauge progress={standings.get(question.id)?.progress ?? 0} />
            <ReportQuestion questionId={question.id} />
          </div>
        )}
      </div>

      <div className="-mb-2 flex items-baseline justify-between gap-3 font-mono text-xs tracking-wide text-ink-soft uppercase">
        <p className="min-w-0">
          {contextLabel ? `${contextLabel(question)} – ` : ''}Nr.{'\u00a0'}
          {question.number}
        </p>
        {/* Leaving loses nothing: each grading is saved as it is given (a guest's only counts for the
            round). On a phone, where the run hides the tab bar, this is the way out. Not beside the
            count: with the gauge, that row has no room for it on a phone. */}
        <Link to={exit.to} className="-my-2 shrink-0 py-2 underline">
          Runde beenden
        </Link>
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
              onKeyDown={enterShortcut.onKeyDown}
              rows={4}
              className={styles.input}
            />
            {enterShortcut.enabled ? (
              <span className="text-xs text-ink-soft">Enter: Lösung anzeigen · Shift+Enter: neue Zeile</span>
            ) : null}
          </label>
          <button type="button" className={buttonClass('primary')} onClick={() => setPhase('assess')}>
            Lösung anzeigen
          </button>
        </>
      ) : (
        <>
          {note.trim() ? <OwnAnswer text={note} /> : null}
          <OfficialAnswerBox text={question.answer_text} images={question.answer_images} />

          {guest ? (
            <>
              <SelfAssessment
                key={question.id}
                name="outcome"
                layout="row"
                onSave={saveGuestGrade}
                saveErrorMessage="Die Bewertung konnte nicht übernommen werden."
                // The Lotsen-Check as a teaser only: AiAnswerCheck keeps it disabled without a login.
                aiCheck={question.answer_text ? { questionId: question.id, answer: note } : null}
              />
              <p className="text-xs text-ink-soft">
                Ohne Anmeldung zählt deine Bewertung nur für diese Runde.{' '}
                <LoginLink className="text-primary underline">Mit Anmeldung</LoginLink> behältst du deinen Lernstand auf
                jedem Gerät.
              </p>
            </>
          ) : (
            <SelfAssessment
              key={question.id}
              name="outcome"
              layout="row"
              onSave={saveGrade}
              saveErrorMessage="Die Bewertung konnte nicht gespeichert werden. Bitte versuche es erneut."
              aiCheck={question.answer_text ? { questionId: question.id, answer: note } : null}
            />
          )}
        </>
      )}
    </article>
  )
}
