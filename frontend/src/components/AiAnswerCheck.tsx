import { useState } from 'react'

import { trackEvent } from '../analytics'
import { ApiError, apiClient } from '../api/client'
import type { AiGrade, GradingOutcome } from '../api/types'
import { OUTCOME_LABELS } from '../labels'
import { useAuthStore } from '../store/authStore'
import { formStyles } from './formStyles'
import { CompassIcon } from './icons/FeatureIcons'

const styles = formStyles('light')

interface AiAnswerCheckProps {
  questionId: number
  answer: string
  // Hands the suggested grade to the self-assessment, which the learner still confirms.
  onSuggest: (outcome: GradingOutcome) => void
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return 'Du hast das Limit für KI-Prüfungen vorerst erreicht. Bewerte dich bitte selbst.'
  }
  return 'Die KI-Prüfung ist gerade nicht verfügbar. Bewerte dich bitte selbst.'
}

// The KI marker lives in the button; what happens to the answer is in the tooltip and the
// accessible description rather than a caption line.
const SEND_NOTICE = 'KI-Prüfung: Deine Antwort wird dafür an Anthropic gesendet.'

// A diagonal corner ribbon ("KI"), clipped by the button (which needs relative + overflow-hidden).
function Ribbon() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-[8px] -right-[22px] w-[74px] rotate-45 bg-primary py-px text-center text-[0.7rem] leading-4 font-bold tracking-widest text-surface shadow-sm"
    >
      KI
    </span>
  )
}

const BUTTON_CLASS = `${styles.button} relative self-start overflow-hidden pr-12`

// "Lotsen-Check" (ADR-0031): a stateless LLM check of the written answer that only
// *suggests* a grade. Accounts without the unlock see a teaser instead of the button.
// Keyed by question in the parent, so each question starts fresh.
export function AiAnswerCheck({ questionId, answer, onSuggest }: AiAnswerCheckProps) {
  const isUnlocked = useAuthStore((s) => s.user?.ai_grading_enabled ?? false)
  const [isChecking, setIsChecking] = useState(false)
  const [result, setResult] = useState<AiGrade | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!isUnlocked) {
    return (
      <button type="button" disabled title="Bald verfügbar: KI-Prüfung deiner Antwort" className={BUTTON_CLASS}>
        <CompassIcon className="mr-2 inline size-5 align-text-bottom" />
        Lotsen-Check · bald
        <Ribbon />
      </button>
    )
  }

  const hasAnswer = answer.trim().length > 0

  async function check() {
    setIsChecking(true)
    setError(null)
    try {
      const grade = await apiClient.post<AiGrade>(`/questions/${questionId}/ai-grade`, { answer })
      trackEvent('ai_check_used')
      setResult(grade)
      onSuggest(grade.outcome)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span id={`ai-check-notice-${questionId}`} className="sr-only">
        {SEND_NOTICE}
      </span>
      <button
        type="button"
        title={SEND_NOTICE}
        aria-describedby={`ai-check-notice-${questionId}`}
        className={BUTTON_CLASS}
        disabled={!hasAnswer || isChecking}
        onClick={check}
      >
        {isChecking ? (
          'Lotse prüft…'
        ) : (
          <>
            <CompassIcon className="mr-2 inline size-5 align-text-bottom" />
            Lotsen-Check
          </>
        )}
        <Ribbon />
      </button>
      {hasAnswer ? null : (
        <p className="text-xs text-ink-soft">Schreibe zuerst eine Antwort, dann kann die KI sie prüfen.</p>
      )}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      {result ? (
        <section role="status" className="flex flex-col gap-1 rounded-tile border border-primary p-4">
          <h3 className="font-mono text-xs tracking-wide text-ink-soft uppercase">
            Lotsen-Vorschlag: {OUTCOME_LABELS[result.outcome]}
          </h3>
          <p className="text-ink">{result.feedback}</p>
          <p className="text-xs text-ink-soft">
            Nur ein Vorschlag – du bestätigst die Bewertung selbst (Enter übernimmt ihn).
          </p>
        </section>
      ) : null}
    </div>
  )
}
