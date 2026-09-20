import { useState } from 'react'

import { trackEvent } from '../analytics'
import { ApiError, apiClient } from '../api/client'
import type { AiGrade, GradingOutcome } from '../api/types'
import { OUTCOME_LABELS } from '../labels'
import { useAuthStore } from '../store/authStore'
import { formStyles } from './formStyles'

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

// "Antwort prüfen lassen" (ADR-0031): a stateless LLM check of the written answer that only
// *suggests* a grade. Accounts without the unlock see a teaser instead of the button.
// Keyed by question in the parent, so each question starts fresh.
export function AiAnswerCheck({ questionId, answer, onSuggest }: AiAnswerCheckProps) {
  const isUnlocked = useAuthStore((s) => s.user?.ai_grading_enabled ?? false)
  const [isChecking, setIsChecking] = useState(false)
  const [result, setResult] = useState<AiGrade | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!isUnlocked) {
    return (
      <div className="flex flex-col gap-1">
        <button type="button" disabled className={`${styles.button} self-start`}>
          Antwort per KI prüfen lassen
        </button>
        <p className="text-xs text-ink-soft">Bald verfügbar.</p>
      </div>
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
      <button
        type="button"
        className={`${styles.button} self-start`}
        disabled={!hasAnswer || isChecking}
        onClick={check}
      >
        {isChecking ? 'Wird geprüft…' : 'Antwort per KI prüfen lassen'}
      </button>
      <p className="text-xs text-ink-soft">
        {hasAnswer
          ? 'Deine Antwort wird zur Prüfung an eine KI (Anthropic) gesendet.'
          : 'Schreibe zuerst eine Antwort, dann kann die KI sie prüfen.'}
      </p>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      {result ? (
        <section role="status" className="flex flex-col gap-1 rounded-tile border border-primary p-4">
          <h3 className="font-mono text-xs tracking-wide text-ink-soft uppercase">
            KI-Vorschlag: {OUTCOME_LABELS[result.outcome]}
          </h3>
          <p className="text-ink">{result.feedback}</p>
          <p className="text-xs text-ink-soft">Nur ein Vorschlag – die Bewertung bestätigst du selbst.</p>
        </section>
      ) : null}
    </div>
  )
}
