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

  it('applies the server offset in the right direction when the device clock is behind', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'))
    // Server is 10 minutes ahead of the device: only 5 minutes are left.
    const { result } = renderHook(() => useExamCountdown('2026-09-19T12:15:00Z', '2026-09-19T12:10:00Z', () => {}))
    expect(formatCountdown(result.current)).toBe('5:00')
  })

  it('ticks once a second and has a value right away', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'))
    const { result } = renderHook(() => useExamCountdown('2026-09-19T12:01:00Z', '2026-09-19T12:00:00Z', () => {}))
    expect(result.current).toBe(60_000)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(59_000)
  })

  it('fires onExpired exactly when the deadline is reached, not before', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'))
    const onExpired = vi.fn()
    renderHook(() => useExamCountdown('2026-09-19T12:00:03Z', '2026-09-19T12:00:00Z', onExpired))
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(onExpired).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(onExpired).toHaveBeenCalledTimes(1)
  })

  it('fires onExpired at once when the deadline has already passed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'))
    const onExpired = vi.fn()
    renderHook(() => useExamCountdown('2026-09-19T11:59:00Z', '2026-09-19T12:00:00Z', onExpired))
    expect(onExpired).toHaveBeenCalledTimes(1)
  })

  it('calls the latest onExpired callback, not the first one', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'))
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ cb }) => useExamCountdown('2026-09-19T12:00:05Z', '2026-09-19T12:00:00Z', cb), {
      initialProps: { cb: first },
    })
    rerender({ cb: second })
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('stops ticking on unmount and restarts for a new deadline', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'))
    const clear = vi.spyOn(window, 'clearInterval')
    const { unmount } = renderHook(() => useExamCountdown('2026-09-19T12:01:00Z', '2026-09-19T12:00:00Z', () => {}))
    unmount()
    expect(clear).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('follows a changed deadline', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'))
    const { result, rerender } = renderHook(
      ({ deadline }) => useExamCountdown(deadline, '2026-09-19T12:00:00Z', () => {}),
      { initialProps: { deadline: '2026-09-19T12:01:00Z' } },
    )
    expect(result.current).toBe(60_000)
    rerender({ deadline: '2026-09-19T12:02:00Z' })
    expect(result.current).toBe(120_000)
  })
})
