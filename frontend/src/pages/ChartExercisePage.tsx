import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ApiError, apiClient } from '../api/client'
import type { ChartAttempt, ChartExerciseSummary, ChartExercisesOverview } from '../api/types'
import { guestOverview, type ChartSheet } from '../chartCatalog'
import { ChartSheetTaskList } from '../components/ChartSheetTaskList'
import { ChartHints, TideForm } from '../components/ChartTools'
import { DiscardChartRun } from '../components/DiscardChartRun'
import { formStyles } from '../components/formStyles'
import { GuestChartRun } from '../components/GuestChartRun'
import { PageLayout } from '../components/PageLayout'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { useChartOverview } from '../hooks/useChartAttempt'
import { useChartCatalog } from '../hooks/useChartCatalog'
import { forgetTideForm, guestTideFormId } from '../hooks/useTideForm'
import { useAuthStore } from '../store/authStore'

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

const NOT_READY = 'Bestätige zuerst, dass du Karte, Begleitheft und Besteck bereitgelegt hast.'

// Before a Kartenaufgabe starts: what to have ready, the sheet's rules, the Formblatt — then start
// or continue the run; below, every task with its solution folded shut. Open without a login when
// the flag is "on" (ADR-0056): a guest's run then happens right here, in the page only.
export function ChartExercisePage() {
  const { number = '' } = useParams()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? <MemberChartExercise number={number} /> : <GuestChartExercise number={number} />
}

function MemberChartExercise({ number }: { number: string }) {
  const navigate = useNavigate()
  const { overview, reload, error: loadError } = useChartOverview()
  const { charts } = useChartCatalog()
  const [ready, setReady] = useState(false)
  const startAction = useAsyncAction()
  const exercise = overview?.exercises.find((e) => String(e.number) === number)
  const sheet = charts?.sheets.find((s) => String(s.number) === number)

  function start() {
    if (!ready) {
      startAction.setError(NOT_READY)
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
    <SheetPage
      number={number}
      overview={overview}
      exercise={exercise}
      sheet={sheet}
      loadError={loadError}
      nav="account"
    >
      {exercise ? (
        <>
          <OwnMaterial
            confirm={exercise.open_attempt_id === null}
            ready={ready}
            onReady={(checked) => {
              setReady(checked)
              startAction.setError(null)
            }}
          />
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
        </>
      ) : null}
    </SheetPage>
  )
}

function GuestChartExercise({ number }: { number: string }) {
  const { charts, failed } = useChartCatalog()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const overview = charts ? guestOverview(charts) : null
  const exercise = overview?.exercises.find((e) => String(e.number) === number)
  const sheet = charts?.sheets.find((s) => String(s.number) === number)

  if (charts && sheet && started) {
    return (
      <PageLayout title={`Kartenaufgabe ${number}`} nav="public" width="lg" compact immersive>
        <GuestChartRun charts={charts} sheet={sheet} />
      </PageLayout>
    )
  }

  return (
    <SheetPage
      number={number}
      overview={overview}
      exercise={exercise}
      sheet={sheet}
      loadError={failed ? 'Die Kartenaufgaben konnten nicht geladen werden.' : null}
      nav="public"
    >
      <OwnMaterial
        confirm
        ready={ready}
        onReady={(checked) => {
          setReady(checked)
          setError(null)
        }}
      />
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className={`${styles.button} self-start`}
        onClick={() => {
          if (!ready) {
            setError(NOT_READY)
            return
          }
          forgetTideForm(guestTideFormId(Number(number)))
          setStarted(true)
        }}
      >
        Kartenaufgabe starten
      </button>
      <p className="text-sm text-ink-soft">
        Ohne Konto wird nichts gespeichert: Antworten und Punkte sind weg, sobald du die Seite verlässt.{' '}
        <Link to="/login" className="text-primary underline">
          Mit einem Konto
        </Link>{' '}
        kannst du unterbrechen und später weitermachen.
      </p>
    </SheetPage>
  )
}

interface SheetPageProps {
  number: string
  overview: ChartExercisesOverview | null
  exercise: ChartExerciseSummary | undefined
  sheet: ChartSheet | undefined
  loadError: string | null
  nav: 'account' | 'public'
  // The start (or continue) controls, shown once the exercise is known.
  children: ReactNode
}

function SheetPage({ number, overview, exercise, sheet, loadError, nav, children }: SheetPageProps) {
  return (
    <PageLayout title={`Kartenaufgabe ${number}`} subtitle={exercise?.title} nav={nav} compact>
      {loadError ? (
        <p role="alert" className="text-danger">
          {loadError}
        </p>
      ) : null}
      {overview === null && !loadError ? <p className="text-ink-soft">Wird geladen…</p> : null}
      {overview && !exercise ? <p className="text-ink">Diese Kartenaufgabe gibt es nicht.</p> : null}
      {overview && exercise ? (
        <>
          <section className="flex flex-col gap-2">
            <p className="text-ink">
              {exercise.task_count} Aufgaben, {exercise.max_points} Punkte, in der Prüfung 90 Minuten. Du bearbeitest
              die Aufgaben nacheinander. Nach jeder Aufgabe siehst du die amtliche Lösung und gibst dir selbst Punkte.
            </p>
          </section>
          {children}
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
          {sheet ? <ChartSheetTaskList sheet={sheet} /> : null}
        </>
      ) : null}
    </PageLayout>
  )
}

interface OwnMaterialProps {
  // Ask to confirm the material is ready — not when a started run is only continued.
  confirm: boolean
  ready: boolean
  onReady: (ready: boolean) => void
}

function OwnMaterial({ confirm, ready, onReady }: OwnMaterialProps) {
  return (
    <section
      aria-labelledby="own-material"
      className="flex flex-col gap-3 rounded-tile border-2 border-accent bg-surface p-4"
    >
      <h2 id="own-material" className="font-serif text-xl text-ink">
        Das brauchst du selbst
      </h2>
      <p className="text-sm text-ink">
        Seekarte, Begleitheft und Navigationsbesteck sind <strong>nicht Teil von SKS Lotse</strong>. Du bekommst sie im
        nautischen Fachhandel. Ohne sie lassen sich die Aufgaben nicht lösen.
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink">
        {OWN_MATERIAL.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {confirm ? (
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" checked={ready} onChange={(event) => onReady(event.target.checked)} className="mt-1" />
          Ich habe Karte, Begleitheft und Besteck bereitgelegt.
        </label>
      ) : null}
    </section>
  )
}
