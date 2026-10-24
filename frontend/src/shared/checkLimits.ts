import { apiClient } from './api/client'
import type { PublicPricing } from './api/types'
import { createLazyExport } from './lazyExport'

// What a Lotsen-Check costs, how long an answer it takes, and how many tokens a new account is
// given. The backend decides and says so in GET /pricing; these are what the screens show until
// that answered (and if it never does). The signup bonus has no stand-in: `null` until known.
export interface CheckLimits {
  catalogCheckTokens: number
  chartCheckTokens: number
  // A subtask of an SBF Navigationsaufgabe (ADR-0071).
  sbfNavigationCheckTokens: number
  maxAnswerChars: number
  signupBonusTokens: number | null
}

export const DEFAULT_CHECK_LIMITS: CheckLimits = {
  catalogCheckTokens: 1,
  chartCheckTokens: 2,
  sbfNavigationCheckTokens: 2,
  maxAnswerChars: 1000,
  signupBonusTokens: null,
}

export function toCheckLimits(pricing: PublicPricing): CheckLimits {
  return {
    catalogCheckTokens: pricing.catalog_check_tokens,
    chartCheckTokens: pricing.chart_check_tokens,
    sbfNavigationCheckTokens: pricing.sbf_navigation_check_tokens,
    maxAnswerChars: pricing.check_max_answer_chars,
    signupBonusTokens: pricing.signup_bonus_tokens,
  }
}

// Fetched once per page load, on the first screen that offers a check or names the signup bonus.
export const checkLimitsSource = createLazyExport(() => apiClient.get<PublicPricing>('/pricing'), toCheckLimits)
