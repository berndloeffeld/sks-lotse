import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import type { ChartAttempt, ChartAttemptTask } from '../api/types'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { scrollBelowIntoView } from '../scroll'
import { ChartTaskText, OfficialSolution, OwnAnswer } from './ChartContent'
import { ChartTaskHistory } from './ChartTools'
import { formStyles } from './formStyles'

const styles = formStyles('light')

interface ChartTaskRunProps {
  attempt: ChartAttempt
  onAnswer: (task: number, answer: string) => Promise<void>
  onPoints: (task: number, points: number) => Promise<void>
}

// One Kartenaufgabe, task after task (ADR-0052): read the task, work it out in the chart, note the
// result, see the official solution, give yourself the points you'd have got. Then the next task.
export function ChartTaskRun({ attempt, onAnswer, onPoints }: ChartTaskRunProps) {
  const task = attempt.tasks.find((t) => t.number === attempt.current_task)
  const articleRef = useRef<HTMLElement>(null)
  const shownTask = useRef(task?.number)

  // The next task starts at its top, not where the previous one's solution was scrolled to.
  useEffect(() => {
    if (task && shownTask.current !== task.number) articleRef.current?.scrollIntoView({ block: 'start' })
    shownTask.current = task?.number
  }, [task])

  if (!task) return <ChartRunResult attempt={attempt} />
  return (
    <article ref={articleRef} className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
        <p className="font-mono text-xs tracking-wide text-ink-soft uppercase">
          <span className="rounded-tile border border-primary px-2 py-0.5 text-primary">
            Aufgabe {task.number} / {attempt.task_count}
          </span>
        </p>
        <p className="font-mono text-xs text-ink-soft">
          {attempt.points} / {attempt.max_points} Punkte bisher
        </p>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-xl text-ink">Aufgabe {task.number}</h2>
        <p className="text-right text-sm text-ink-soft">Max. erreichbare Punkte: {task.max_points}</p>
      </div>
      <ChartTaskText task={task} />
      {/* Keyed per task, so each one starts with an empty answer and no points chosen. */}
      {task.answer_text === null ? (
        <AnswerForm key={task.number} task={task} onAnswer={onAnswer} />
      ) : (
        <PointsForm key={task.number} task={task} onPoints={onPoints} />
      )}
    </article>
  )
}

function AnswerForm({ task, onAnswer }: { task: ChartAttemptTask; onAnswer: ChartTaskRunProps['onAnswer'] }) {
  const [answer, setAnswer] = useState('')
  const { run, isPending, error } = useAsyncAction()
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fieldRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        void run(
          () => onAnswer(task.number, answer),
          'Die Antwort konnte nicht gespeichert werden. Bitte versuche es erneut.',
        )
      }}
    >
      <label className={styles.label}>
        Deine Antwort
        <textarea
          ref={fieldRef}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          rows={4}
          className={styles.input}
        />
        <span className="text-xs text-ink-soft">
          Kurse, Peilungen und Orte trägst du in deine Seekarte ein, Zeichnungen machst du auf Papier. Hier notierst du
          die Ergebnisse.
        </span>
      </label>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <button type="submit" className={`${styles.button} self-start`} disabled={isPending}>
        {isPending ? 'Wird gespeichert…' : 'Lösung anzeigen'}
      </button>
    </form>
  )
}

function PointsForm({ task, onPoints }: { task: ChartAttemptTask; onPoints: ChartTaskRunProps['onPoints'] }) {
  const [points, setPoints] = useState<number | null>(null)
  const { run, isPending, error, setError } = useAsyncAction()
  const continueRef = useRef<HTMLButtonElement>(null)
  const choices = Array.from({ length: task.max_points + 1 }, (_, i) => i)

  useEffect(() => {
    // Clear of the tool bar a phone shows at the bottom of the screen.
    scrollBelowIntoView(continueRef.current, 64)
  }, [])

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (points === null) {
          setError('Wähle zuerst, wie viele Punkte du dir gibst.')
          return
        }
        void run(
          () => onPoints(task.number, points),
          'Die Punkte konnten nicht gespeichert werden. Bitte versuche es erneut.',
        )
      }}
    >
      <OwnAnswer text={task.answer_text ?? ''} />
      <OfficialSolution task={task} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm text-ink-soft">
          Wie viele Punkte hättest du in der Prüfung bekommen? Die Toleranzen stehen in eckigen Klammern.
        </legend>
        <div className="flex flex-wrap gap-2">
          {choices.map((choice) => (
            <label
              key={choice}
              className={`cursor-pointer rounded-tile border-2 px-4 py-2 font-mono text-sm ${
                points === choice ? 'border-primary bg-primary text-surface' : 'border-primary text-primary'
              }`}
            >
              <input
                type="radio"
                name="points"
                value={choice}
                checked={points === choice}
                onChange={() => {
                  setPoints(choice)
                  setError(null)
                }}
                className="sr-only"
              />
              {choice}
            </label>
          ))}
        </div>
      </fieldset>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <button ref={continueRef} type="submit" className={`${styles.button} self-start`} disabled={isPending}>
        {isPending ? 'Wird gespeichert…' : 'Weiter'}
      </button>
    </form>
  )
}

function ChartRunResult({ attempt }: { attempt: ChartAttempt }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-serif text-2xl text-primary">Kartenaufgabe abgeschlossen</h2>
      <p className="text-ink">
        Du hast dir <strong>{attempt.points}</strong> von {attempt.max_points} Punkten gegeben.
      </p>
      <Link to="/charts" className={`${styles.button} self-start`}>
        Zur Übersicht
      </Link>
      <h3 className="font-serif text-xl text-ink">Alle Aufgaben</h3>
      <ChartTaskHistory attempt={attempt} />
    </section>
  )
}
