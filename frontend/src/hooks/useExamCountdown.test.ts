import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatCountdown } from '../format'
import { useExamCountdown } from './useExamCountdown'

describe('useExamCountdown', () => {
  afterEach(() => vi.useRealTimers())

  it('counts down by the server clock, not the device clock', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'))
    // The server thinks it is 10 minutes earlier than the device does.
    const serverNow = '2026-09-19T11:50:00Z'
    const deadline = '2026-09-19T12:10:00Z'
    const { result } = renderHook(() => useExamCountdown(deadline, serverNow, () => {}))
    expect(formatCountdown(result.current)).toBe('20:00')
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(formatCountdown(result.current)).toBe('19:00')
  })

  it('fires onExpired exactly once', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'))
    const onExpired = vi.fn()
    renderHook(() => useExamCountdown('2026-09-19T12:00:02Z', '2026-09-19T12:00:00Z', onExpired))
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(onExpired).toHaveBeenCalledTimes(1)
  })
})
