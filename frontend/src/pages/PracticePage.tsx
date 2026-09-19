import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useParams } from 'react-router-dom'

import { apiClient } from '../api/client'
import type { GradingOutcome, Question, QuestionProgress, Topic } from '../api/types'
import { CourseGauge } from '../components/CourseGauge'
import { formStyles } from '../components/formStyles'
import { PageLayout } from '../components/PageLayout'
import { RichText } from '../components/RichText'
import { SUBJECT_LABELS } from '../hooks/useProgressSummary'
import { OUTCOME_LABELS } from '../labels'
import { isLearned, streakProgress } from '../progress'

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
// everything is learned and the learner asks for it — all of them.
function buildRun(questions: Question[], streaks: Map<number, number>, includeLearned: boolean): Question[] {
  return shuffled(includeLearned ? questions : questions.filter((q) => !isLearned(streaks.get(q.id) ?? 0)))
}

// Loads the topic's questions, the learner's per-question streaks and the
// topic's display name, in parallel, once on mount.
function usePracticeData(subject: string, topicSlug: string) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [streaks, setStreaks] = useState<Map<number, number>>(new Map())
  const [topic, setTopic] = useState<Topic | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const query = `subject=${encodeURIComponent(subject)}`
    try {
      const [questionData, progressData, topicData] = await Promise.all([
        apiClient.get<Question[]>(`/questions?${query}&topic=${encodeURIComponent(topicSlug)}`),
        apiClient.get<QuestionProgress[]>('/progress/questions'),
        apiClient.get<Topic[]>(`/topics?${query}`),
      ])
      setQuestions(questionData)
      setStreaks(new Map(progressData.map((p) => [p.question_id, p.correct_streak])))
      setTopic(topicData.find((t) => t.slug === topicSlug) ?? null)
    } catch {
      setError('Die Fragen konnten nicht geladen werden.')
    } finally {
      setIsLoading(false)
    }
  }, [subject, topicSlug])

  useEffect(() => {
    // Same fetch-on-mount pattern as useProgressSummary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  return { questions, streaks, setStreaks, topic, isLoading, error }
}

// How long the boat gets to sail to its new position before the next question.
const BOAT_SETTLE_MS = 1000

// Nothing sails under reduced motion, so there is nothing to wait for.
function letBoatSettle(): Promise<void> {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, BOAT_SETTLE_MS))
}

interface PracticeRunProps {
  questions: Question[]
  streaks: Map<number, number>
  onGraded: (questionId: number, streak: number) => void
}

// The learning loop for one run (ADR-0023): read the question, optionally
// jot down an answer, reveal the official answer, assess yourself —
// Richtig / Teilweise Richtig / Falsch — and watch the boat move (CourseGauge).
function PracticeRun({ questions, streaks, onGraded }: PracticeRunProps) {
  const [run, setRun] = useState(() => buildRun(questions, streaks, false))
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('answer')
  const [note, setNote] = useState('')
  const [outcome, setOutcome] = useState<GradingOutcome | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [tally, setTally] = useState<GradingOutcome[]>([])
  const [newlyLearned, setNewlyLearned] = useState(0)
  const [feedback, setFeedback] = useState('')
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const groupRef = useRef<HTMLFieldSetElement>(null)
  const radioRefs = useRef<(HTMLInputElement | null)[]>([])
  const saveRef = useRef<HTMLButtonElement>(null)
  const styles = formStyles('light')

  // Keyboard flow: each phase hands focus to the control the learner needs
  // next, so the whole loop works without a mouse (see the key handlers below).
  useEffect(() => {
    if (phase === 'answer') noteRef.current?.focus()
    else groupRef.current?.focus()
  }, [phase, index, run])

  // Tab cycles through the radios (focus only, no selection). The first Tab
  // from the group itself is native and lands on Richtig.
  const cycleFocus = (from: number, backwards: boolean) => {
    const count = OUTCOMES.length
    radioRefs.current[(from + (backwards ? count - 1 : 1)) % count]?.focus()
  }

  const startRun = (includeLearned: boolean) => {
    setRun(buildRun(questions, streaks, includeLearned))
    setIndex(0)
    setPhase('answer')
    setNote('')
    setOutcome(null)
    setTally([])
    setNewlyLearned(0)
  }

  const nextQuestion = () => {
    setIndex((i) => i + 1)
    setPhase('answer')
    setNote('')
    setOutcome(null)
  }

  const question = run[index] as Question | undefined

  const saveGrade = async () => {
    if (!question || !outcome) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const result = await apiClient.post<QuestionProgress>(`/progress/questions/${question.id}`, { outcome })
      const before = streaks.get(question.id) ?? 0
      if (result.learned && !isLearned(before)) setNewlyLearned((n) => n + 1)
      onGraded(question.id, result.correct_streak)
      setTally((t) => [...t, outcome])
      // The result is announced to screen readers; sighted learners see the
      // boat sail to the new status before the next question comes up.
      setFeedback(
        result.learned
          ? 'Gelernt.'
          : outcome === 'richtig'
            ? 'Richtig – ein Stück näher am Ziel.'
            : 'Zurück zum Start – die Frage kommt wieder.',
      )
      await letBoatSettle()
      nextQuestion()
    } catch {
      setSaveError('Die Bewertung konnte nicht gespeichert werden. Bitte versuche es erneut.')
    } finally {
      setIsSaving(false)
    }
  }

  if (run.length === 0) {
    return (
      <section className="flex flex-col items-start gap-4">
        <h2 className="font-serif text-2xl text-primary">Alles gelernt</h2>
        <p className="text-sm text-ink-soft">Du hast jede Frage dieses Themas gelernt.</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={styles.button} onClick={() => startRun(true)}>
            Alle Fragen wiederholen
          </button>
          <Link to="/learn" className={styles.link + ' self-center'}>
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
        <div className="flex flex-wrap gap-3">
          <button type="button" className={styles.button} onClick={() => startRun(false)}>
            Neue Runde
          </button>
          <Link to="/learn" className={styles.link + ' self-center'}>
            Zur Themenübersicht
          </Link>
        </div>
      </section>
    )
  }

  const streak = streaks.get(question.id) ?? 0

  return (
    <article className="flex flex-col gap-6">
      <p role="status" className="sr-only">
        {feedback}
      </p>
      <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
        <p className="font-mono text-xs tracking-wide text-ink-soft uppercase">
          Frage {index + 1} von {run.length} · Nr. {question.number}
        </p>
        {/* Keyed per question: a new question starts where it stands, only a
            grading of this one makes the boat sail. */}
        <CourseGauge key={question.id} progress={streakProgress(streak)} />
      </div>

      <h2 className="font-serif text-xl whitespace-pre-line text-ink outline-none">
        <RichText text={question.question_text} />
      </h2>

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
            <section className="flex flex-col gap-1">
              <h3 className="font-mono text-xs tracking-wide text-ink-soft uppercase">Deine Antwort</h3>
              <p className="whitespace-pre-line text-ink">{note}</p>
            </section>
          ) : null}
          <section className="flex flex-col gap-1 rounded-tile border border-ink bg-surface p-4">
            <h3 className="font-mono text-xs tracking-wide text-ink-soft uppercase">Amtliche Antwort</h3>
            {question.answer_text ? (
              <p className="whitespace-pre-line text-ink">
                <RichText text={question.answer_text} />
              </p>
            ) : (
              // A few official answers are only a sketch in the catalog PDF,
              // with no text at all — and images aren't extracted yet.
              <p className="text-ink-soft italic">
                Die amtliche Antwort zu dieser Frage besteht nur aus einer Skizze, die SKS Lotse noch nicht anzeigen
                kann.
              </p>
            )}
          </section>

          <fieldset ref={groupRef} tabIndex={-1} className="flex flex-col gap-2 outline-none" disabled={isSaving}>
            <legend className="mb-2 text-sm text-ink-soft">Wie gut war deine Antwort?</legend>
            {OUTCOMES.map((o, i) => (
              <label key={o} className="flex items-center gap-2 text-ink">
                <input
                  ref={(el) => {
                    radioRefs.current[i] = el
                  }}
                  type="radio"
                  name="outcome"
                  value={o}
                  checked={outcome === o}
                  onChange={() => setOutcome(o)}
                  onKeyDown={(event) => {
                    if (event.key === 'Tab') {
                      event.preventDefault()
                      cycleFocus(i, event.shiftKey)
                    } else if (event.key === 'Enter') {
                      event.preventDefault()
                      flushSync(() => setOutcome(o))
                      saveRef.current?.focus()
                    }
                  }}
                  className="accent-primary"
                />
                {OUTCOME_LABELS[o]}
              </label>
            ))}
          </fieldset>

          {saveError ? (
            <p role="alert" className={styles.error}>
              {saveError}
            </p>
          ) : null}

          <button
            ref={saveRef}
            type="button"
            className={styles.button}
            disabled={!outcome || isSaving}
            onClick={saveGrade}
          >
            {isSaving ? 'Wird gespeichert…' : 'Bewertung speichern'}
          </button>
        </>
      )}
    </article>
  )
}

export function PracticePage() {
  const { subject = '', topic: topicSlug = '' } = useParams()
  const { questions, streaks, setStreaks, topic, isLoading, error } = usePracticeData(subject, topicSlug)

  const onGraded = useCallback(
    (questionId: number, streak: number) => setStreaks((current) => new Map(current).set(questionId, streak)),
    [setStreaks],
  )

  return (
    <PageLayout title={topic?.name ?? 'Lernen'} subtitle={SUBJECT_LABELS[subject] ?? subject} backTo="/learn">
      {isLoading ? (
        <p className="text-sm text-ink-soft">Fragen werden geladen…</p>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : questions.length === 0 ? (
        <p className="text-sm text-ink-soft">Zu diesem Thema gibt es keine Fragen.</p>
      ) : (
        <PracticeRun questions={questions} streaks={streaks} onGraded={onGraded} />
      )}
    </PageLayout>
  )
}
