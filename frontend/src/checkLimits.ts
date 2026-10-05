import { apiClient } from './api/client'
import type { PublicPricing } from './api/types'
import { createLazyExport } from './lazyExport'

// What a Lotsen-Check costs and how long an answer it takes. The backend decides and says so in
// GET /pricing; these are what the screens show until that answered (and if it never does).
export interface CheckLimits {
  catalogCheckTokens: number
  chartCheckTokens: number
  maxAnswerChars: number
}

export const DEFAULT_CHECK_LIMITS: CheckLimits = { catalogCheckTokens: 1, chartCheckTokens: 2, maxAnswerChars: 1000 }

export function toCheckLimits(pricing: PublicPricing): CheckLimits {
  return {
    catalogCheckTokens: pricing.catalog_check_tokens,
    chartCheckTokens: pricing.chart_check_tokens,
    maxAnswerChars: pricing.check_max_answer_chars,
  }
}

// Fetched once per page load, on the first screen that offers a check.
export const checkLimitsSource = createLazyExport(() => apiClient.get<PublicPricing>('/pricing'), toCheckLimits)
