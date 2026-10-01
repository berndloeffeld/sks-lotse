import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ApiError, apiClient } from '../api/client'
import type { ChartAttempt } from '../api/types'
import { ChartHints, TideForm } from '../components/ChartTools'
import { DiscardChartRun } from '../components/DiscardChartRun'
import { formStyles } from '../components/formStyles'
import { PageLayout } from '../components/PageLayout'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { useChartOverview } from '../hooks/useChartAttempt'

const styles = formStyles('light')

// What the learner needs on the table — none of it is part of SKS Lotse.
const OWN_MATERIAL = [
  'Übungskarte 49 (INT 1463), ohne Eintragungen',
  'Karte 1/INT 1 (Zeichen, Abkürzungen, Begriffe)',
  'Begleitheft für die Kartenaufgaben im Fach Navigation für den SKS (Ausgabe 2013)',
  'Navigationsbesteck: zwei Kursdreiecke und ein Zirkel',
  'Taschenrechner (nicht programmierbar)',
  'Bleistift, Radiergummi und Papier für das Stromdreieck',
]

// Before a Kartenaufgabe starts: what to have ready, the sheet's rules, the Formblatt — then start
// or continue the run.
export function ChartExercisePage() {
  const { number } = useParams()
  const navigate = useNavigate()
  const { overview, reload, error: loadError } = useChartOverview()
  const [ready, setReady] = useState(false)
  const startAction = useAsyncAction()
  const exercise = overview?.exercises.find((e) => String(e.number) === number)

  function start() {
    if (!ready) {
      startAction.setError('Bestätige zuerst, dass du Karte, Begleitheft und Besteck bereitgelegt hast.')
      return
    }
    void startAction.run(
      async () => {
        const attempt = await apiClient.post<ChartAttempt>(`/chart-exercises/${number}/attempts`)
        navigate(`/charts/attempts/${attempt.id}`)
      },
      (e) =>
        e instanceof ApiError && e.status === 409
          ? 'Diese Kartenaufgabe läuft bereits. Lade die Seite neu, um sie fortzusetzen.'
          : 'Die Kartenaufgabe konnte nicht gestartet werden.',
    )
  }

  return (
    <PageLayout title={`Kartenaufgabe ${number ?? ''}`} compact>
      {loadError ? (
        <p role="alert" className="text-danger">
          {loadError}
        </p>
      ) : null}
      {overview === null && !loadError ? <p className="text-ink-soft">Wird geladen…</p> : null}
      {overview && !exercise ? <p className="text-ink">Diese Kartenaufgabe gibt es nicht.</p> : null}
      {exercise ? (
        <>
          <section className="flex flex-col gap-2">
            <p className="text-ink">
              {exercise.task_count} Aufgaben, {exercise.max_points} Punkte, in der Prüfung 90 Minuten. Du bearbeitest
              die Aufgaben nacheinander. Nach jeder Aufgabe siehst du die amtliche Lösung und gibst dir selbst Punkte.
            </p>
          </section>

          <section
            aria-labelledby="own-material"
            className="flex flex-col gap-3 rounded-tile border-2 border-accent bg-surface p-4"
          >
            <h2 id="own-material" className="font-serif text-xl text-ink">
              Das brauchst du selbst
            </h2>
            <p className="text-sm text-ink">
              Seekarte, Begleitheft und Navigationsbesteck sind <strong>nicht Teil von SKS Lotse</strong>. Du bekommst
              sie im nautischen Fachhandel. Ohne sie lassen sich die Aufgaben nicht lösen.
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink">
              {OWN_MATERIAL.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {exercise.open_attempt_id === null ? (
              <label className="flex items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={ready}
                  onChange={(event) => {
                    setReady(event.target.checked)
                    startAction.setError(null)
                  }}
                  className="mt-1"
                />
                Ich habe Karte, Begleitheft und Besteck bereitgelegt.
              </label>
            ) : null}
          </section>

          {startAction.error ? (
            <p role="alert" className={styles.error}>
              {startAction.error}
            </p>
          ) : null}
          {exercise.open_attempt_id !== null ? (
            <>
              <Link to={`/charts/attempts/${exercise.open_attempt_id}`} className={`${styles.button} self-start`}>
                Begonnene Kartenaufgabe fortsetzen
              </Link>
              <DiscardChartRun
                attemptId={exercise.open_attempt_id}
                label="Begonnene Kartenaufgabe verwerfen"
                onDiscarded={reload}
              />
            </>
          ) : (
            <button
              type="button"
              className={`${styles.button} self-start`}
              disabled={startAction.isPending}
              onClick={start}
            >
              {startAction.isPending ? 'Wird gestartet…' : 'Kartenaufgabe starten'}
            </button>
          )}

          <details className="rounded-tile border border-border p-3">
            <summary className="cursor-pointer text-ink">Hinweise zur Kartenaufgabe</summary>
            <div className="pt-3">
              <ChartHints overview={overview} />
            </div>
          </details>
          <details className="rounded-tile border border-border p-3">
            <summary className="cursor-pointer text-ink">Formblatt Gezeiten</summary>
            <div className="pt-3">
              <TideForm overview={overview} />
            </div>
          </details>
          <Link to="/charts" className={styles.link}>
            Alle Kartenaufgaben
          </Link>
        </>
      ) : null}
    </PageLayout>
  )
}
