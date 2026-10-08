import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { ApiError, apiClient } from '../api/client'
import type { ChartAttempt, ChartExerciseSummary, ChartExercisesOverview } from '../api/types'
import { guestOverview, type ChartSheet } from '../chartCatalog'
import { ChartSheetTaskList } from '../components/ChartSheetTaskList'
import { ChartHints, TideForm } from '../components/ChartTools'
import { DiscardChartRun } from '../components/DiscardChartRun'
import { GuestChartRun } from '../components/GuestChartRun'
import { GuestCta } from '../components/LoginLink'
import { PageLayout } from '../components/PageLayout'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { useChartOverview } from '../hooks/useChartAttempt'
import { useChartCatalog } from '../hooks/useChartCatalog'
import { forgetTideForm, guestTideFormId } from '../hooks/useTideForm'
import { useAuthStore } from '../store/authStore'
import { useNavigateWhileMounted } from '../hooks/useNavigateWhileMounted'
import { NotFoundPage } from './NotFoundPage'
import { ErrorMessage } from '../components/Messages'
import { buttonClass } from '../components/buttonStyles'
import { sectionHeading } from '../components/headingStyles'

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

// A guest's run is its own history entry (?run), so "Zurück" leads from it to this page.
const RUN_PARAM = 'run'

// Before a Kartenaufgabe starts: what to have ready, the sheet's rules, the Formblatt — then start
// or continue the run; below, every task with its solution folded shut. Open without a login when
// the flag is "on" (ADR-0056): a guest's run then happens right here, in the page only.
export function ChartExercisePage() {
  const { number = '' } = useParams()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? <MemberChartExercise number={number} /> : <GuestChartExercise number={number} />
}

function MemberChartExercise({ number }: { number: string }) {
  const navigate = useNavigateWhileMounted()
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
      onRetry={reload}
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
          <ErrorMessage>{startAction.error}</ErrorMessage>
          {exercise.open_attempt_id !== null ? (
            <>
              <Link
                to={`/charts/attempts/${exercise.open_attempt_id}`}
                className={`${buttonClass('primary')} self-start`}
              >
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
              className={`${buttonClass('primary')} self-start`}
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
  const { charts, failed, reload } = useChartCatalog()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The run lives in this page only (ADR-0056), so ?run alone doesn't bring one back: after a
  // reload, or from a link that carries it, this is the page before the start again. That also
  // keeps the first render the prerendered one.
  const [searchParams, setSearchParams] = useSearchParams()
  const [startedHere, setStartedHere] = useState(false)
  const inRun = searchParams.has(RUN_PARAM)
  const started = inRun && startedHere
  const overview = charts ? guestOverview(charts) : null
  const exercise = overview?.exercises.find((e) => String(e.number) === number)
  const sheet = charts?.sheets.find((s) => String(s.number) === number)

  useEffect(() => {
    if (inRun && !startedHere) setSearchParams({}, { replace: true })
  }, [inRun, startedHere, setSearchParams])

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
      onRetry={reload}
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
      <ErrorMessage>{error}</ErrorMessage>
      <button
        type="button"
        className={`${buttonClass('primary')} self-start`}
        onClick={() => {
          if (!ready) {
            setError(NOT_READY)
            return
          }
          forgetTideForm(guestTideFormId(Number(number)))
          setStartedHere(true)
          setSearchParams({ [RUN_PARAM]: '1' })
        }}
      >
        Kartenaufgabe starten
      </button>
      <GuestCta>
        Ohne Konto wird nichts gespeichert: Antworten und Punkte sind weg, sobald du die Seite verlässt. Mit einem Konto
        kannst du unterbrechen und später weitermachen.
      </GuestCta>
    </SheetPage>
  )
}

interface SheetPageProps {
  number: string
  overview: ChartExercisesOverview | null
  exercise: ChartExerciseSummary | undefined
  sheet: ChartSheet | undefined
  loadError: string | null
  onRetry: () => unknown
  nav: 'account' | 'public'
  // The start (or continue) controls, shown once the exercise is known.
  children: ReactNode
}

function SheetPage({ number, overview, exercise, sheet, loadError, onRetry, nav, children }: SheetPageProps) {
  if (overview && !exercise) {
    return <NotFoundPage what="Diese Kartenaufgabe gibt es nicht." backTo="/charts" backLabel="Alle Kartenaufgaben" />
  }
  return (
    <PageLayout title={`Kartenaufgabe ${number}`} subtitle={exercise?.title} nav={nav} compact>
      <ErrorMessage onRetry={onRetry}>{loadError}</ErrorMessage>
      {overview === null && !loadError ? <p className="text-ink-soft">Wird geladen…</p> : null}
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
          <Link to="/charts" className={buttonClass('tertiary')}>
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
      <h2 id="own-material" className={sectionHeading}>
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
