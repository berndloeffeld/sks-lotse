import { Link } from 'react-router-dom'

import { buttonClass } from '../shared/components/buttonStyles'
import { sectionHeading } from '../shared/components/headingStyles'
import { useLazyExport } from '../shared/hooks/useLazyExport'
import { navigationSource } from './navigationCatalog'
import { NavigationHints } from './NavigationHints'
import { SbfPageLayout } from './SbfPageLayout'

// /navigation: the 15 Navigationsaufgaben See, open to guests (ADR-0068).
export function NavigationOverviewPage() {
  const { data, failed, reload } = useLazyExport(navigationSource)
  return (
    <SbfPageLayout title="Navigationsaufgaben" subtitle="Sportbootführerschein See · 15 amtliche Aufgaben">
      <p className="text-ink">
        Die Navigationsaufgabe ist der zweite Teil der theoretischen Prüfung zum SBF See. Hier übst du alle 15 amtlichen
        Aufgaben, Teilaufgabe für Teilaufgabe: deine Antwort, dann das amtliche Ergebnis, dann bewertest du dich selbst.
        Ohne Anmeldung, und es wird nichts gespeichert.
      </p>
      {data ? (
        <>
          <section aria-labelledby="aufgaben" className="flex flex-col gap-4">
            <h2 id="aufgaben" className={sectionHeading}>
              Die Aufgaben
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {data.tasks.map((task) => (
                <li key={task.number} className="flex flex-col gap-2 rounded-tile border border-border bg-surface p-4">
                  <Link
                    to={`/navigation/${task.number}`}
                    className="font-serif text-xl text-primary underline-offset-4 hover:underline"
                  >
                    Navigationsaufgabe {task.number}
                  </Link>
                  <p className="text-sm text-ink-soft">{task.situation[0]}</p>
                </li>
              ))}
            </ul>
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
