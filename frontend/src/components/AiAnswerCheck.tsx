import { useState, type KeyboardEvent, type Ref } from 'react'

import { trackEvent } from '../analytics'
import { ApiError, apiClient } from '../api/client'
import type { AiGrade, GradingOutcome, PublicPricing } from '../api/types'
import { formatEurCents } from '../format'
import { useApiQuery } from '../hooks/useApiQuery'
import { OUTCOME_LABELS } from '../labels'
import { useAuthStore } from '../store/authStore'
import { formStyles } from './formStyles'
import { CompassIcon } from './icons/FeatureIcons'

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
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return 'Der Lotse ist für diese Frage oder für heute ausgelastet. Bewerte dich bitte selbst.'
  }
  if (error instanceof ApiError && error.status === 422) {
    return 'Diese Antwort kann der Lotse nicht prüfen. Bewerte dich bitte selbst.'
  }
  if (error instanceof ApiError && error.status === 402) {
    return 'Deine Tokens sind aufgebraucht. Bewerte dich bitte selbst.'
  }
  return 'Der Lotse ist gerade nicht erreichbar. Bewerte dich bitte selbst.'
}

// What happens to the answer lives in the tooltip and the accessible description, not in a caption.
const SEND_NOTICE = 'KI-Prüfung: Deine Antwort wird dafür an Anthropic gesendet.'

// A diagonal corner ribbon ("KI"), clipped by the row (which needs relative + overflow-hidden).
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

// Tokens/packages teaser (ADR-0043) shown while an account has none — its own component so the
// pricing fetch only ever runs while it's actually mounted (rules of hooks: useApiQuery can't be
// called conditionally inside AiAnswerCheck itself).
function TokenPricingTeaser() {
  const { data } = useApiQuery('ai-check-pricing', () => apiClient.get<PublicPricing>('/pricing'))
  if (!data?.packages) return null
  return (
    <p className="text-xs text-ink-soft">
      bald verfügbar · {data.packages.map((p) => `${p.tokens} für ${formatEurCents(p.price_cents)}`).join(' · ')}
    </p>
  )
}

// "Antwort vom Lotsen bewerten lassen" (ADR-0031, ADR-0043): the fourth choice under the grade
// radios. A stateless LLM check of the written answer that only *suggests* a grade, 1 token each;
// the learner who is sure just grades. Accounts with no tokens see it dimmed with a price teaser
// instead of a buy button — there is no purchase flow yet. Keyed by question in the parent.
export function AiAnswerCheck({ questionId, answer, onSuggest, buttonRef, onButtonKeyDown }: AiAnswerCheckProps) {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [isChecking, setIsChecking] = useState(false)
  const [result, setResult] = useState<AiGrade | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasTokens = (user?.token_balance ?? 0) > 0
  const remaining = user?.ai_checks_remaining ?? 0
  const hasAnswer = answer.trim().length > 0
  const tooLong = answer.length > AI_CHECK_MAX_ANSWER_CHARS

  let hint = `Die KI schlägt dir eine Bewertung vor · noch ${remaining} diese Woche · ${user?.token_balance ?? 0} Token(s)`
  if (isChecking) hint = 'Lotse prüft…'
  else if (!hasAnswer) hint = 'Schreibe zuerst eine Antwort'
  else if (tooLong) hint = `Nur für Antworten bis ${AI_CHECK_MAX_ANSWER_CHARS} Zeichen`
  else if (remaining <= 0) hint = 'ab Montag wieder'

  const isDisabled = !hasTokens || isChecking || !hasAnswer || tooLong || remaining <= 0

  async function check() {
    setIsChecking(true)
    setError(null)
    try {
      const grade = await apiClient.post<AiGrade>(`/questions/${questionId}/ai-grade`, { answer })
      trackEvent('ai_check_used')
      if (user) {
        setUser({ ...user, ai_checks_remaining: grade.remaining_this_week, token_balance: grade.tokens_remaining })
      }
      setResult(grade)
      onSuggest(grade.outcome)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span id={`ai-check-notice-${questionId}`} className="sr-only">
        {SEND_NOTICE}
      </span>
      {result ? (
        <section
          role="status"
          className="flex flex-col gap-1 rounded-tile border-l-4 border-accent bg-surface px-3 py-2"
        >
          <h3 className="font-mono text-xs tracking-wide text-accent uppercase">
            Lotsen-Vorschlag: {OUTCOME_LABELS[result.outcome]}
          </h3>
          <p className="text-sm text-ink-soft">{result.feedback}</p>
          <p className="text-xs text-ink-soft">
            Nur ein Vorschlag – du bestätigst die Bewertung selbst (Enter übernimmt ihn).
          </p>
        </section>
      ) : null}
      {result ? null : (
        <>
          <button
            ref={buttonRef}
            type="button"
            disabled={isDisabled}
            title={hasTokens ? SEND_NOTICE : 'Bald verfügbar: KI-Prüfung deiner Antwort'}
            aria-describedby={`ai-check-notice-${questionId}`}
            onClick={check}
            onKeyDown={onButtonKeyDown}
            className="relative flex min-h-10 items-center gap-3 overflow-hidden rounded-tile border border-dashed border-accent py-1.5 pr-[72px] pl-3 text-left text-ink transition hover:bg-surface-alt disabled:opacity-60 disabled:hover:bg-transparent"
          >
            <CompassIcon className="size-6 shrink-0 text-accent" />
            <span className="flex flex-col">
              <span className="font-mono text-sm tracking-wide uppercase">Antwort vom Lotsen bewerten lassen</span>
              <span className="text-xs text-ink-soft">{hasTokens ? hint : 'bald verfügbar'}</span>
            </span>
            <Ribbon />
          </button>
          {hasTokens ? null : <TokenPricingTeaser />}
        </>
      )}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
