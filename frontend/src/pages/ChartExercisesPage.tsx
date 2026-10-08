import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { ChartExerciseSummary } from '../api/types'
import { guestOverview } from '../chartCatalog'
import { ChartTile } from '../components/ChartTile'
import { GuestCta } from '../components/LoginLink'
import { PageLayout } from '../components/PageLayout'
import { useChartOverview } from '../hooks/useChartAttempt'
import { useChartCatalog } from '../hooks/useChartCatalog'
import { useAuthStore } from '../store/authStore'
import { ErrorMessage } from '../components/Messages'

function statusLabel(exercise: ChartExerciseSummary) {
  if (exercise.open_attempt_id !== null) return 'Begonnen'
  if (exercise.last_points !== null) return `Zuletzt ${exercise.last_points} / ${exercise.max_points} Punkte`
  return 'Noch nicht bearbeitet'
}

// The official Kartenaufgaben (ADR-0052), each opening its preparation page. Open without a login
// when the flag is "on" (ADR-0056): guests get the list from the export, without runs; a prerendered
// page starts as the guest's and becomes the learner's once the session is known.
export function ChartExercisesPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? <MemberChartExercises /> : <GuestChartExercises />
}

function MemberChartExercises() {
  const { overview, error, reload } = useChartOverview()
  return (
    <ChartExercisesLayout nav="account">
      <ExerciseList exercises={overview?.exercises ?? null} error={error} onRetry={reload} status={statusLabel} />
    </ChartExercisesLayout>
  )
}

function GuestChartExercises() {
  const { charts, failed, reload } = useChartCatalog()
  return (
    <ChartExercisesLayout nav="public">
      <ExerciseList
        exercises={charts ? guestOverview(charts).exercises : null}
        error={failed ? 'Die Kartenaufgaben konnten nicht geladen werden.' : null}
        onRetry={reload}
      />
      <GuestCta>Ohne Konto wird nichts gespeichert. Mit einem Konto behältst du deine Durchgänge und Punkte.</GuestCta>
    </ChartExercisesLayout>
  )
}

function ChartExercisesLayout({ nav, children }: { nav: 'account' | 'public'; children: ReactNode }) {
  return (
    <PageLayout title="Kartenaufgaben" nav={nav} compact>
      <section className="flex flex-col gap-3">
        <p className="text-ink">
          Die amtlichen Kartenaufgaben für den zweiten Teil der schriftlichen Prüfung: je 30 Punkte in 90 Minuten,
          gerechnet und gezeichnet in der Übungskarte 49 (INT 1463).
        </p>
        <p className="text-sm text-ink-soft">
          Seekarte, Begleitheft und Navigationsbesteck brauchst du selbst. SKS Lotse zeigt dir die Aufgaben eine nach
          der anderen, danach die amtliche Lösung, und du gibst dir die Punkte selbst.
        </p>
      </section>
      {children}
    </PageLayout>
  )
}

interface ExerciseListProps {
  exercises: ChartExerciseSummary[] | null
  error: string | null
  onRetry: () => unknown
  // Where the learner stands; guests have none.
  status?: (exercise: ChartExerciseSummary) => string
}

function ExerciseList({ exercises, error, onRetry, status }: ExerciseListProps) {
  return (
    <>
      <ErrorMessage onRetry={onRetry}>{error}</ErrorMessage>
      {exercises === null && !error ? <p className="text-ink-soft">Wird geladen…</p> : null}
      <ul className="grid gap-4 sm:grid-cols-2">
        {exercises?.map((exercise) => (
          <li key={exercise.number} className="flex">
            <Link to={`/charts/${exercise.number}`} className="flex flex-1">
              <ChartTile
                className="flex-1 hover:bg-surface-alt"
                label={`Kartenaufgabe ${exercise.number}`}
                title={exercise.title}
                description={exercise.summary}
                footer={
                  <p className="font-mono text-xs">
                    {exercise.task_count} Aufgaben · {exercise.max_points} Punkte
                    {status ? (
                      <>
                        <br />
                        {status(exercise)}
                      </>
                    ) : null}
                  </p>
                }
              />
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
