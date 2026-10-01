import { Link } from 'react-router-dom'

import type { ChartExerciseSummary } from '../api/types'
import { PageLayout } from '../components/PageLayout'
import { useChartOverview } from '../hooks/useChartAttempt'

function statusLabel(exercise: ChartExerciseSummary) {
  if (exercise.open_attempt_id !== null) return 'Begonnen'
  if (exercise.last_points !== null) return `Zuletzt ${exercise.last_points} / ${exercise.max_points} Punkte`
  return 'Noch nicht bearbeitet'
}

// The ten official Kartenaufgaben (ADR-0052), each opening its preparation page.
export function ChartExercisesPage() {
  const { overview, error } = useChartOverview()

  return (
    <PageLayout title="Kartenaufgaben" compact>
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
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      {overview === null && !error ? <p className="text-ink-soft">Wird geladen…</p> : null}
      <ul className="flex flex-col">
        {overview?.exercises.map((exercise) => (
          <li key={exercise.number} className="border-b border-border last:border-b-0">
            <Link
              to={`/charts/${exercise.number}`}
              className="flex items-center justify-between gap-4 px-2 py-3 hover:bg-surface-alt"
            >
              <span className="text-ink">Kartenaufgabe {exercise.number}</span>
              <span className="text-right font-mono text-xs text-ink-soft">{statusLabel(exercise)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </PageLayout>
  )
}
