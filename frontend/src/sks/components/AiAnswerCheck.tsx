import { useState, type KeyboardEvent, type Ref } from 'react'

import { trackEvent } from '../analytics'
import { apiClient } from '../api/client'
import type { AiGrade, GradingOutcome } from '../api/types'
import { OUTCOME_LABELS } from '../labels'
import { useAuthStore } from '../store/authStore'
import { lotseErrorMessage } from '../lotseErrorMessage'
import { LotseCheckButton } from './LotseCheckButton'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { useCheckLimits } from '../hooks/useCheckLimits'
import { ErrorMessage } from './Messages'

interface AiAnswerCheckProps {
  questionId: number
  answer: string
  // Hands the suggested grade to the self-assessment, which the learner still confirms.
  onSuggest: (outcome: GradingOutcome) => void
  // So the parent can fold the button into the Tab loop of the grade radios.
  buttonRef?: Ref<HTMLButtonElement>
  onButtonKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void
  // Overrides the default "write an answer first" hint for a context where the learner can't
  // write one here (e.g. the exam's read-only self-assessment, where `answer` is already fixed).
  noAnswerHint?: string
}

// The checklist of a partly right or wrong answer; nothing for a right one (or an older backend).
function PointList({ title, mark, points }: { title: string; mark: string; points: string[] | undefined }) {
  if (!points || points.length === 0) return null
  return (
    <div className="mt-1">
      <h4 className="text-xs font-medium text-ink">{title}</h4>
      <ul className="flex flex-col gap-0.5 text-sm text-ink-soft">
        {points.map((point) => (
          <li key={point} className="flex gap-2">
            <span aria-hidden="true">{mark}</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// The Lotsen-Check of a catalog question (ADR-0031, ADR-0043, ADR-0044): the fourth choice under
// the grade radios. A stateless LLM check of the written answer that only *suggests* a grade, 1
// token each — the token balance is the sole spending control. The learner who is sure just
// grades. The button and its token states are LotseCheckButton's. Keyed by question in the parent.
export function AiAnswerCheck({
  questionId,
  answer,
  onSuggest,
  buttonRef,
  onButtonKeyDown,
  noAnswerHint,
}: AiAnswerCheckProps) {
  const setUser = useAuthStore((s) => s.setUser)
  // A longer answer is rejected (422) before the model sees it. Exam answers may be much longer, so
  // the button says so up front instead of failing with "nicht erreichbar".
  const { catalogCheckTokens, maxAnswerChars } = useCheckLimits()
  const { run, isPending: isChecking, error } = useAsyncAction()
  const [result, setResult] = useState<AiGrade | null>(null)

  let blockedHint: string | null = null
  if (answer.trim().length === 0) blockedHint = noAnswerHint ?? 'Schreibe zuerst eine Antwort'
  else if (answer.length > maxAnswerChars) blockedHint = `Nur für Antworten bis ${maxAnswerChars} Zeichen`

  function check() {
    return run(async () => {
      const grade = await apiClient.post<AiGrade>(`/questions/${questionId}/ai-grade`, { answer })
      trackEvent('ai_check_used')
      // The user as it is now, not as it was when this render started: the answer can take a while.
      const current = useAuthStore.getState().user
      if (current) setUser({ ...current, token_balance: grade.tokens_remaining })
      setResult(grade)
      onSuggest(grade.outcome)
    }, lotseErrorMessage)
  }

  return (
    <div className="flex flex-col gap-3">
      {result ? (
        <section
          role="status"
          className="flex flex-col gap-1 rounded-tile border-l-4 border-accent bg-surface px-3 py-2"
        >
          <h3 className="font-mono text-xs tracking-wide text-accent-strong uppercase">
            Lotsen-Vorschlag: {OUTCOME_LABELS[result.outcome]}
          </h3>
          <p className="text-sm text-ink-soft">{result.feedback}</p>
          <PointList title="Das hast du genannt" mark="✓" points={result.richtig_genannt} />
          <PointList title="Das fehlt noch" mark="✗" points={result.fehlt} />
          <p className="mt-2 text-xs text-ink-soft">
            Nur ein Vorschlag – du bestätigst die Bewertung selbst (Enter übernimmt ihn).
          </p>
        </section>
      ) : (
        <LotseCheckButton
          noticeId={`ai-check-notice-${questionId}`}
          cost={catalogCheckTokens}
          pitch="Die KI schlägt dir eine Bewertung vor"
          isChecking={isChecking}
          blockedHint={blockedHint}
          onCheck={check}
          buttonRef={buttonRef}
          onButtonKeyDown={onButtonKeyDown}
        />
      )}
      <ErrorMessage>{error}</ErrorMessage>
    </div>
  )
}
