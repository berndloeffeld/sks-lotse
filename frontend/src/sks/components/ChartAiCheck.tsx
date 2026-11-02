import type { KeyboardEvent, Ref } from 'react'

import { trackEvent } from '../analytics'
import type { ChartAiSuggestion, ChartAttemptTask } from '../api/types'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { useCheckLimits } from '../hooks/useCheckLimits'
import { lotseErrorMessage } from '../lotseErrorMessage'
import { LotseCheckButton } from './LotseCheckButton'
import { ErrorMessage } from './Messages'

/** The Lotsen-Check's suggestion for a task: points, what's right or wrong, and the probable mistake. */
export function ChartAiSuggestionView({
  suggestion,
  maxPoints,
  hint = true,
}: {
  suggestion: ChartAiSuggestion
  maxPoints: number
  // Under the current task, a reminder that the points stay the learner's own.
  hint?: boolean
}) {
  return (
    <section role="status" className="flex flex-col gap-1 rounded-tile border-l-4 border-accent bg-surface px-3 py-2">
      <h3 className="font-mono text-xs tracking-wide text-accent-strong uppercase">
        Lotsen-Vorschlag: {suggestion.points} von {maxPoints} {maxPoints === 1 ? 'Punkt' : 'Punkten'}
      </h3>
      <p className="text-sm text-ink-soft">{suggestion.feedback}</p>
      {suggestion.suspected_error ? (
        <p className="text-sm text-ink-soft">
          <strong className="font-semibold text-ink">Vermuteter Fehler:</strong> {suggestion.suspected_error}
        </p>
      ) : null}
      {hint ? <p className="mt-2 text-xs text-ink-soft">Nur ein Vorschlag – die Punkte gibst du dir selbst.</p> : null}
    </section>
  )
}

interface ChartAiCheckProps {
  task: ChartAttemptTask
  // Absent in a guest's run: nothing of it is ever sent, the check is only a teaser there.
  onAiCheck?: (task: number) => Promise<void>
  // So the points form can fold the button into the Tab loop of its choices.
  buttonRef?: Ref<HTMLButtonElement>
  onButtonKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void
}

// The Lotsen-Check of a Kartenaufgabe (ADR-0058), under the points of the answered task, as in the catalog:
// suggests the points and guesses where the learner went wrong. Once per task — the suggestion is
// stored with the answer, so it is shown again after a reload. Not for a task where a drawing scores.
export function ChartAiCheck({ task, onAiCheck, buttonRef, onButtonKeyDown }: ChartAiCheckProps) {
  const { run, isPending, error } = useAsyncAction()
  const { chartCheckTokens, maxAnswerChars } = useCheckLimits()
  if (!task.ai_checkable) return null
  if (task.ai_suggestion) return <ChartAiSuggestionView suggestion={task.ai_suggestion} maxPoints={task.max_points} />

  const answer = task.answer_text ?? ''
  let blockedHint: string | null = null
  if (answer.trim().length === 0) blockedHint = 'Ohne Antwort gibt es nichts zu prüfen'
  else if (answer.length > maxAnswerChars) blockedHint = `Nur für Antworten bis ${maxAnswerChars} Zeichen`

  function check() {
    if (!onAiCheck) return
    void run(async () => {
      await onAiCheck(task.number)
      trackEvent('ai_check_used')
    }, lotseErrorMessage)
  }

  return (
    <div className="flex flex-col gap-3">
      <LotseCheckButton
        noticeId={`chart-ai-check-notice-${task.number}`}
        cost={chartCheckTokens}
        pitch="Die KI schlägt dir Punkte vor und sucht deinen Fehler"
        isChecking={isPending}
        blockedHint={blockedHint}
        onCheck={check}
        buttonRef={buttonRef}
        onButtonKeyDown={onButtonKeyDown}
      />
      <ErrorMessage>{error}</ErrorMessage>
    </div>
  )
}
