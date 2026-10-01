import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { apiClient } from '../api/client'
import type { ChartAttempt } from '../api/types'

import { ChartTaskRun } from '../components/ChartTaskRun'
import { ChartSidePanel, ChartToolBar } from '../components/ChartTools'
import { formStyles } from '../components/formStyles'
import { PageLayout } from '../components/PageLayout'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { useChartAttempt, useChartOverview } from '../hooks/useChartAttempt'
import { useTideForm } from '../hooks/useTideForm'

const styles = formStyles('light')

// One run through a Kartenaufgabe: the current task on the left, the Formblatt, the tasks so far and
// the rules beside it — or, on a phone, behind the bar at the bottom of the screen.
export function ChartAttemptPage() {
  const { id } = useParams()
  const { attempt, isLoading, error, answer, awardPoints } = useChartAttempt(id)
  const { overview } = useChartOverview()
  const tideForm = useTideForm(id ?? '')

  return (
    <PageLayout title={attempt ? `Kartenaufgabe ${attempt.exercise_number}` : 'Kartenaufgabe'} width="lg" compact>
      {isLoading ? <p className="text-ink-soft">Kartenaufgabe wird geladen…</p> : null}
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      {attempt ? (
        <div className="grid gap-8 pb-16 lg:grid-cols-[minmax(0,1fr)_28rem] lg:pb-0">
          <div className="flex flex-col gap-8">
            <ChartTaskRun attempt={attempt} onAnswer={answer} onPoints={awardPoints} />
            <DiscardRun attempt={attempt} />
          </div>
          <div className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
              <ChartSidePanel attempt={attempt} overview={overview} tideForm={tideForm} />
            </div>
          </div>
          <div className="lg:hidden">
            <ChartToolBar attempt={attempt} overview={overview} tideForm={tideForm} />
          </div>
        </div>
      ) : null}
    </PageLayout>
  )
}

// Deletes the run (its answers and points) — the way to start the same Kartenaufgabe over, since only
// one run per exercise can be open.
function DiscardRun({ attempt }: { attempt: ChartAttempt }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const { run, isPending, error } = useAsyncAction()
  const label = attempt.completed_at ? 'Diesen Durchgang löschen' : 'Diesen Durchgang verwerfen'

  function discard() {
    return run(async () => {
      await apiClient.delete(`/chart-exercises/attempts/${attempt.id}`)
      navigate(`/charts/${attempt.exercise_number}`)
    }, 'Der Durchgang konnte nicht gelöscht werden.')
  }

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-sm text-ink">Antworten und Punkte dieses Durchgangs werden gelöscht.</p>
          <button type="button" className={styles.button} disabled={isPending} onClick={() => void discard()}>
            {isPending ? 'Wird gelöscht…' : 'Endgültig löschen'}
          </button>
          <button type="button" className={styles.link} onClick={() => setConfirming(false)}>
            Abbrechen
          </button>
        </div>
      ) : (
        <button type="button" className={`${styles.link} self-start`} onClick={() => setConfirming(true)}>
          {label}
        </button>
      )}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </section>
  )
}
