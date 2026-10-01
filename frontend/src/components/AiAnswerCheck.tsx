import { useState, type KeyboardEvent, type Ref } from 'react'

import { trackEvent } from '../analytics'
import { apiClient } from '../api/client'
import type { AiGrade, GradingOutcome } from '../api/types'
import { OUTCOME_LABELS } from '../labels'
import { useAuthStore } from '../store/authStore'
import { formStyles } from './formStyles'
import { lotseErrorMessage } from '../lotseErrorMessage'
import { LotseCheckButton } from './LotseCheckButton'
import { useAsyncAction } from '../hooks/useAsyncAction'

const styles = formStyles('light')

// Mirrors GRADING_MAX_ANSWER_CHARS in the backend (app/core/config.py): a longer answer is rejected
// with 422 before the model sees it. Exam answers may be much longer (up to 10,000 characters),
// so the button says so up front instead of failing with "nicht erreichbar".
export const AI_CHECK_MAX_ANSWER_CHARS = 1000

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
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const { run, isPending: isChecking, error } = useAsyncAction()
  const [result, setResult] = useState<AiGrade | null>(null)

  let blockedHint: string | null = null
  if (answer.trim().length === 0) blockedHint = noAnswerHint ?? 'Schreibe zuerst eine Antwort'
  else if (answer.length > AI_CHECK_MAX_ANSWER_CHARS)
    blockedHint = `Nur für Antworten bis ${AI_CHECK_MAX_ANSWER_CHARS} Zeichen`

  function check() {
    return run(async () => {
      const grade = await apiClient.post<AiGrade>(`/questions/${questionId}/ai-grade`, { answer })
      trackEvent('ai_check_used')
      if (user) setUser({ ...user, token_balance: grade.tokens_remaining })
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
          <h3 className="font-mono text-xs tracking-wide text-accent uppercase">
            Lotsen-Vorschlag: {OUTCOME_LABELS[result.outcome]}
          </h3>
          <p className="text-sm text-ink-soft">{result.feedback}</p>
          <p className="mt-2 text-xs text-ink-soft">
            Nur ein Vorschlag – du bestätigst die Bewertung selbst (Enter übernimmt ihn).
          </p>
        </section>
      ) : (
        <LotseCheckButton
          noticeId={`ai-check-notice-${questionId}`}
          cost={1}
          pitch="Die KI schlägt dir eine Bewertung vor"
          isChecking={isChecking}
          blockedHint={blockedHint}
          onCheck={check}
          buttonRef={buttonRef}
          onButtonKeyDown={onButtonKeyDown}
        />
      )}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
