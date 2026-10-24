import { Link } from 'react-router-dom'

import { Band } from '../shared/components/Bands'
import { buttonClass } from '../shared/components/buttonStyles'
import { formatDate } from '../shared/format'
import { useNavigationOverview } from './hooks/useNavigationAttempt'
import { summaryLine } from './savedRun'

// The number of subtasks of every Navigationsaufgabe (ADR-0068); the overview counts in it.
const SUBTASKS = 9

// /profile on SBF Lotse: the learner's saved runs through the Navigationsaufgaben (ADR-0071), the
// open ones to resume first, then those done with their latest result.
export function SbfRunsPage() {
  const { overview, failed, reload } = useNavigationOverview()

  if (!overview) {
    return (
      <Band className="pt-10 pb-16">
        {failed ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-danger">Deine Läufe konnten nicht geladen werden.</p>
            <button type="button" className={buttonClass('secondary')} onClick={() => void reload()}>
              Erneut laden
            </button>
          </div>
        ) : (
          <p role="status" className="text-ink-soft">
            Lädt …
          </p>
        )}
      </Band>
    )
  }

  const worked = overview.tasks.filter((task) => task.open_attempt_id !== null || task.completed_count > 0)
  const ordered = [
    ...worked.filter((task) => task.open_attempt_id !== null),
    ...worked.filter((task) => task.open_attempt_id === null),
  ]

  return (
    <Band className="pt-10 pb-16">
      <div className="flex max-w-2xl flex-col gap-4">
        {ordered.length === 0 ? (
          <p className="text-ink-soft">
            Noch keine Läufe.{' '}
            <Link to="/navigation" className="text-primary underline hover:no-underline">
              Zu den Navigationsaufgaben
            </Link>
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {ordered.map((task) => (
              <li key={task.number} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                <span className="text-ink">
                  Navigationsaufgabe {task.number}
                  <span className="text-ink-soft"> · {summaryLine(task, SUBTASKS, overview.pass_points)}</span>
                  {task.open_attempt_id === null && task.last_completed_at ? (
                    <span className="text-ink-soft"> · {formatDate(task.last_completed_at)}</span>
                  ) : null}
                </span>
                {task.open_attempt_id !== null ? (
                  <Link to={`/navigation/${task.number}?run=1`} className="text-primary underline hover:no-underline">
                    Fortsetzen
                  </Link>
                ) : (
                  <span className="text-sm text-ink-soft">
                    {task.completed_count} {task.completed_count === 1 ? 'Lauf' : 'Läufe'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Band>
  )
}
