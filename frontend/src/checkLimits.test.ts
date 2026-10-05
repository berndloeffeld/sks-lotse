import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PublicPricing } from './api/types'
import { DEFAULT_CHECK_LIMITS, checkLimitsSource, toCheckLimits } from './checkLimits'
import { jsonResponse } from './test/fixtures'

const PRICING = { catalog_check_tokens: 3, chart_check_tokens: 5, check_max_answer_chars: 400 } as PublicPricing

describe('checkLimits', () => {
  afterEach(() => checkLimitsSource.reset())

  it("shows today's numbers until the backend has answered", () => {
    expect(DEFAULT_CHECK_LIMITS).toEqual({ catalogCheckTokens: 1, chartCheckTokens: 2, maxAnswerChars: 1000 })
  })

  it('maps the pricing answer to the limits the screens use', () => {
    expect(toCheckLimits(PRICING)).toEqual({ catalogCheckTokens: 3, chartCheckTokens: 5, maxAnswerChars: 400 })
  })

  it('fetches /pricing once and keeps the answer', async () => {
    checkLimitsSource.reset()
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(PRICING))
    vi.stubGlobal('fetch', fetchMock)

    const [first, second] = await Promise.all([checkLimitsSource.load(), checkLimitsSource.load()])
    await checkLimitsSource.load()

    expect(first).toEqual(second)
    expect(first.maxAnswerChars).toBe(400)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/pricing$/)
  })
})
