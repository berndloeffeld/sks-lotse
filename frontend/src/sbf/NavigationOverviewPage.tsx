import { Link } from 'react-router-dom'

import { buttonClass } from '../shared/components/buttonStyles'
import { sectionHeading } from '../shared/components/headingStyles'
import { useLazyExport } from '../shared/hooks/useLazyExport'
import { navigationSource, type NavigationExport } from './navigationCatalog'
import { sbfAccountsOpen } from '../shared/siteConfig'
import { useAuthStore } from '../shared/store/authStore'
import type { SbfNavigationOverview, SbfNavigationTaskSummary } from './api/types'
import { useNavigationOverview } from './hooks/useNavigationAttempt'
import { NavigationHints } from './NavigationHints'
import { summaryLine } from './savedRun'
import { SbfPageLayout } from './SbfPageLayout'

// /navigation: the 15 Navigationsaufgaben See, open to guests (ADR-0068).
export function NavigationOverviewPage() {
  const { data, failed, reload } = useLazyExport(navigationSource)
  const accounts = sbfAccountsOpen()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return (
    <SbfPageLayout title="Navigationsaufgaben" subtitle="Sportbootführerschein See · 15 amtliche Aufgaben">
      <p className="text-ink">
        Die Navigationsaufgabe ist der zweite Teil der theoretischen Prüfung zum SBF See. Hier übst du alle 15 amtlichen
        Aufgaben, Teilaufgabe für Teilaufgabe: deine Antwort, dann das amtliche Ergebnis, dann bewertest du dich selbst.{' '}
        {accounts
          ? 'Ohne Anmeldung bleibt nichts gespeichert; mit Konto setzt du Läufe fort und lässt den Lotsen deine Antworten prüfen.'
          : 'Ohne Anmeldung, und es wird nichts gespeichert.'}
      </p>
      {data ? (
        <>
          <section aria-labelledby="aufgaben" className="flex flex-col gap-4">
            <h2 id="aufgaben" className={sectionHeading}>
              Die Aufgaben
            </h2>
            {accounts && isAuthenticated ? <TaskListWithRuns data={data} /> : <TaskList data={data} overview={null} />}
          </section>
          <section aria-labelledby="hinweise" className="flex flex-col gap-3">
            <h2 id="hinweise" className={sectionHeading}>
              Hinweise
            </h2>
            <NavigationHints data={data} />
          </section>
        </>
      ) : failed ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-danger">Die Aufgaben konnten nicht geladen werden.</p>
          <button type="button" className={buttonClass('secondary')} onClick={() => void reload()}>
            Erneut laden
          </button>
        </div>
      ) : (
        <p role="status" className="text-ink-soft">
          Lädt …
        </p>
      )}
    </SbfPageLayout>
  )
}

// A signed-in learner's runs on the cards (ADR-0071): one request for all 15.
function TaskListWithRuns({ data }: { data: NavigationExport }) {
  const { overview } = useNavigationOverview()
  return <TaskList data={data} overview={overview} />
}

function TaskList({ data, overview }: { data: NavigationExport; overview: SbfNavigationOverview | null }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {data.tasks.map((task) => {
        const summary = overview?.tasks.find((item) => item.number === task.number)
        return (
          <li key={task.number} className="flex flex-col gap-2 rounded-tile border border-border bg-surface p-4">
            <Link
              to={`/navigation/${task.number}`}
              className="font-serif text-xl text-primary underline-offset-4 hover:underline"
            >
              Navigationsaufgabe {task.number}
            </Link>
            <p className="text-sm text-ink-soft">{task.situation[0]}</p>
            {summary && overview ? (
              <RunStatus summary={summary} count={task.subtasks.length} passPoints={overview.pass_points} />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

// The open run to resume, or the latest result.
function RunStatus({
  summary,
  count,
  passPoints,
}: {
  summary: SbfNavigationTaskSummary
  count: number
  passPoints: number
}) {
  const line = summaryLine(summary, count, passPoints)
  if (!line) return null
  const open = summary.open_attempt_id !== null
  const passed = (summary.last_points ?? 0) >= passPoints
  const tone = open
    ? 'border-accent text-accent-strong'
    : passed
      ? 'border-success text-success'
      : 'border-border text-ink-soft'
  const tag = <span className={`self-start rounded-tile border px-2 py-0.5 font-mono text-xs ${tone}`}>{line}</span>
  return open ? (
    <Link to={`/navigation/${summary.number}?run=1`} className="self-start">
      {tag}
    </Link>
  ) : (
    tag
  )
}
