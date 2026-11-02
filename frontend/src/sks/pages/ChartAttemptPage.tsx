import { useParams } from 'react-router-dom'

import { ChartTaskRun } from '../components/ChartTaskRun'
import { ChartSidePanel, ChartToolBar } from '../components/ChartTools'
import { DiscardChartRun } from '../components/DiscardChartRun'
import { PageLayout } from '../components/PageLayout'
import { useChartAttempt, useChartOverview } from '../hooks/useChartAttempt'
import { useTideForm } from '../hooks/useTideForm'
import { useNavigateWhileMounted } from '../hooks/useNavigateWhileMounted'
import { ErrorMessage } from '../components/Messages'

// One run through a Kartenaufgabe: the current task on the left, the Formblatt and the tasks so far
// beside it — or, on a phone, behind the bar at the bottom of the screen.
export function ChartAttemptPage() {
  const { id } = useParams()
  const navigate = useNavigateWhileMounted()
  const { attempt, isLoading, error, reload, answer, awardPoints, aiCheck } = useChartAttempt(id)
  const { overview } = useChartOverview()
  const tideForm = useTideForm(id ?? '')

  return (
    <PageLayout
      title={attempt ? `Kartenaufgabe ${attempt.exercise_number}` : 'Kartenaufgabe'}
      width="lg"
      compact
      immersive
    >
      {isLoading ? <p className="text-ink-soft">Kartenaufgabe wird geladen…</p> : null}
      <ErrorMessage onRetry={reload}>{error}</ErrorMessage>
      {attempt ? (
        <div className="grid gap-8 pb-16 lg:grid-cols-[minmax(0,1fr)_28rem] lg:pb-0">
          <div className="flex flex-col gap-8">
            <ChartTaskRun attempt={attempt} onAnswer={answer} onPoints={awardPoints} onAiCheck={aiCheck} />
            {/* An open run is discarded on its exercise page, not beside every task. */}
            {attempt.completed_at ? (
              <div className="border-t border-border pt-4">
                <DiscardChartRun
                  attemptId={attempt.id}
                  label="Diesen Durchgang löschen"
                  onDiscarded={() => navigate(`/charts/${attempt.exercise_number}`)}
                />
              </div>
            ) : null}
          </div>
          <div className="hidden lg:block">
            <div className="sticky top-[calc(var(--header-height)+1.75rem)] max-h-[calc(100vh-var(--header-height)-2.75rem)] overflow-y-auto">
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
