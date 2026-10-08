import { useCallback, useMemo, useState } from 'react'

import { guestOverview, type ChartExport, type ChartSheet } from '../chartCatalog'
import { answerTask, awardPoints, guestAttempt, startGuestRun } from '../chartGuestRun'
import { guestTideFormId, useTideForm } from '../hooks/useTideForm'
import { ChartTaskRun } from './ChartTaskRun'
import { ChartSidePanel, ChartToolBar } from './ChartTools'

// A guest's run through a Kartenaufgabe (ADR-0056): laid out like a learner's (ChartAttemptPage),
// but held in the page only — nothing is sent or saved, and it is gone with the page. The Formblatt
// is scratch work in this browser as for learners, under the sheet's number; a new run starts it empty.
export function GuestChartRun({ charts, sheet }: { charts: ChartExport; sheet: ChartSheet }) {
  const [run, setRun] = useState(startGuestRun)
  const attempt = guestAttempt(sheet, run)
  const overview = useMemo(() => guestOverview(charts), [charts])
  const tideForm = useTideForm(guestTideFormId(sheet.number))

  const onAnswer = useCallback(
    async (task: number, answerText: string) => setRun((current) => answerTask(sheet, current, task, answerText)),
    [sheet],
  )
  const onPoints = useCallback(
    async (task: number, points: number) => setRun((current) => awardPoints(sheet, current, task, points)),
    [sheet],
  )

  return (
    <div className="grid gap-8 pb-16 lg:grid-cols-[minmax(0,1fr)_28rem] lg:pb-0">
      <div className="flex flex-col gap-8">
        <ChartTaskRun attempt={attempt} onAnswer={onAnswer} onPoints={onPoints} guest />
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
  )
}
