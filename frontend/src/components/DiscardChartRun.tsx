import { useState } from 'react'

import { apiClient } from '../api/client'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { forgetTideForm } from '../hooks/useTideForm'
import { ErrorMessage } from './Messages'
import { buttonClass } from './buttonStyles'

// Deletes a run (its answers and points) after a confirmation — the way to start the same
// Kartenaufgabe over, since only one run per exercise can be open. Offered where the run is seen as
// a whole (the exercise page, the finished run's result), not beside every task.
export function DiscardChartRun({
  attemptId,
  label,
  onDiscarded,
}: {
  attemptId: number
  label: string
  onDiscarded: () => unknown
}) {
  const [confirming, setConfirming] = useState(false)
  const { run, isPending, error } = useAsyncAction()

  function discard() {
    return run(async () => {
      await apiClient.delete(`/chart-exercises/attempts/${attemptId}`)
      // The run's Formblatt is scratch work of the run: it goes with it.
      forgetTideForm(attemptId)
      await onDiscarded()
    }, 'Der Durchgang konnte nicht gelöscht werden.')
  }

  return (
    <section className="flex flex-col gap-3">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-sm text-ink">Antworten und Punkte dieses Durchgangs werden gelöscht.</p>
          <button type="button" className={buttonClass('danger')} disabled={isPending} onClick={() => void discard()}>
            {isPending ? 'Wird gelöscht…' : 'Endgültig löschen'}
          </button>
          <button type="button" className={buttonClass('tertiary')} onClick={() => setConfirming(false)}>
            Abbrechen
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`${buttonClass('dangerOutline')} self-start`}
          onClick={() => setConfirming(true)}
        >
          {label}
        </button>
      )}
      <ErrorMessage>{error}</ErrorMessage>
    </section>
  )
}
