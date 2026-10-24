import { Link, useParams, useSearchParams } from 'react-router-dom'

import { buttonClass } from '../components/buttonStyles'
import { sectionHeading } from '../components/headingStyles'
import { useLazyExport } from '../hooks/useLazyExport'
import { navigationSource, navigationTask } from './navigationCatalog'
import { NavigationHints } from './NavigationHints'
import { NavigationTaskRun } from './NavigationTaskRun'
import { SbfNotFoundPage } from './SbfNotFoundPage'
import { SbfPageLayout } from './SbfPageLayout'

// A run is its own history entry (?run), so "Zurück" leads from it to the task's page.
const RUN_PARAM = 'run'

// /navigation/<n>: one Navigationsaufgabe, its situation and hints, then the run (ADR-0068).
export function NavigationTaskPage() {
  const { number = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { data, failed, reload } = useLazyExport(navigationSource)
  const title = `Navigationsaufgabe ${number}`

  if (!data) {
    return (
      <SbfPageLayout title={title} compact>
        {failed ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-danger">Die Aufgabe konnte nicht geladen werden.</p>
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
  const task = /^\d+$/.test(number) ? navigationTask(data, Number(number)) : null
  if (!task) return <SbfNotFoundPage />

  if (params.has(RUN_PARAM)) {
    return (
      <SbfPageLayout title={title} subtitle="9 Teilaufgaben · 1 Punkt je Teilaufgabe" width="lg" compact>
        <NavigationTaskRun key={task.number} data={data} task={task} />
      </SbfPageLayout>
    )
  }

  return (
    <SbfPageLayout title={title} subtitle="Sportbootführerschein See · 9 Teilaufgaben" compact>
      <section aria-label="Situation" className="flex flex-col gap-2 text-ink">
        {task.situation.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </section>
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className={buttonClass('primary')} onClick={() => setParams({ [RUN_PARAM]: '1' })}>
          Aufgabe starten
        </button>
        <Link to="/navigation" className="text-primary underline hover:no-underline">
          Alle Navigationsaufgaben
        </Link>
      </div>
      <section aria-labelledby="hinweise" className="flex flex-col gap-3">
        <h2 id="hinweise" className={sectionHeading}>
          Hinweise
        </h2>
        <NavigationHints data={data} />
      </section>
    </SbfPageLayout>
  )
}
