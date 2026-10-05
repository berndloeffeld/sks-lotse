import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PublicPricing } from '../api/types'
import { DEFAULT_CHECK_LIMITS, checkLimitsSource } from '../checkLimits'
import { jsonResponse } from '../test/fixtures'
import { useCheckLimits } from './useCheckLimits'

describe('useCheckLimits', () => {
  afterEach(() => checkLimitsSource.reset())

  it('returns the primed limits at once', () => {
    const { result } = renderHook(() => useCheckLimits())

    expect(result.current).toEqual(DEFAULT_CHECK_LIMITS)
  })

  it('switches to what the backend says once it has answered', async () => {
    checkLimitsSource.reset()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ catalog_check_tokens: 4, chart_check_tokens: 6, check_max_answer_chars: 500 } as PublicPricing),
      ),
    )

    const { result } = renderHook(() => useCheckLimits())
    expect(result.current).toEqual(DEFAULT_CHECK_LIMITS)

    await waitFor(() =>
      expect(result.current).toEqual({ catalogCheckTokens: 4, chartCheckTokens: 6, maxAnswerChars: 500 }),
    )
  })

  it('keeps the defaults when /pricing cannot be read', async () => {
    checkLimitsSource.reset()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'boom' }, 500)),
    )

    const { result } = renderHook(() => useCheckLimits())
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(result.current).toEqual(DEFAULT_CHECK_LIMITS)
  })
})
