import { useCallback, useMemo, useRef, useState } from 'react'

import { guestOverview, type ChartExport, type ChartSheet } from '../chartCatalog'
import { answerTask, awardPoints, guestAttempt, isRunInProgress, startGuestRun } from '../chartGuestRun'
import { useLeaveConfirmation } from '../hooks/useLeaveConfirmation'
import { guestTideFormId, useTideForm } from '../hooks/useTideForm'
import { ChartTaskRun } from './ChartTaskRun'
import { ChartSidePanel, ChartToolBar } from './ChartTools'
import { buttonClass } from './buttonStyles'
import { Modal } from './Modal'

// A guest's run through a Kartenaufgabe (ADR-0056): laid out like a learner's (ChartAttemptPage),
// but held in the page only — nothing is sent or saved, and it is gone with the page. The Formblatt
// is scratch work in this browser as for learners, under the sheet's number; a new run starts it empty.
// Leaving a run in progress (Back, a link, closing the tab) asks first.
export function GuestChartRun({ charts, sheet }: { charts: ChartExport; sheet: ChartSheet }) {
  const [run, setRun] = useState(startGuestRun)
  const attempt = guestAttempt(sheet, run)
  const overview = useMemo(() => guestOverview(charts), [charts])
  const tideForm = useTideForm(guestTideFormId(sheet.number))
  const leave = useLeaveConfirmation(isRunInProgress(run))

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
      {leave.state === 'blocked' ? <DiscardRunDialog onStay={leave.reset} onDiscard={leave.proceed} /> : null}
    </div>
  )
}

// The question before a navigation away from the run: staying is the default (focused; Escape and a
// click beside the dialog stay too).
function DiscardRunDialog({ onStay, onDiscard }: { onStay: () => void; onDiscard: () => void }) {
  const stayRef = useRef<HTMLButtonElement>(null)
  return (
    <Modal labelledBy="discard-run-title" describedBy="discard-run-text" onClose={onStay} initialFocusRef={stayRef}>
      <h2 id="discard-run-title" className="font-serif text-xl text-primary">
        Durchgang verwerfen?
      </h2>
      <p id="discard-run-text" className="text-ink-soft">
        Ohne Konto wird der Durchgang nicht gespeichert. Wenn du die Seite verlässt, sind deine Antworten und Punkte
        weg.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button ref={stayRef} type="button" className={buttonClass('primary')} onClick={onStay}>
          Weiterarbeiten
        </button>
        <button type="button" className={buttonClass('danger')} onClick={onDiscard}>
          Verwerfen
        </button>
      </div>
    </Modal>
  )
}
