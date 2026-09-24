import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useAsyncAction } from './useAsyncAction'

describe('useAsyncAction', () => {
  it('is pending only while the action runs', async () => {
    let finish: () => void = () => {}
    const { result } = renderHook(() => useAsyncAction())
    expect(result.current.isPending).toBe(false)

    let running: Promise<void> = Promise.resolve()
    act(() => {
      running = result.current.run(() => new Promise<void>((resolve) => (finish = resolve)), 'Fehler')
    })
    expect(result.current.isPending).toBe(true)

    await act(async () => {
      finish()
      await running
    })
    expect(result.current.isPending).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('shows the fixed message when the action throws, and is no longer pending', async () => {
    const { result } = renderHook(() => useAsyncAction())
    await act(() => result.current.run(() => Promise.reject(new Error('nope')), 'Hat nicht geklappt.'))
    expect(result.current.error).toBe('Hat nicht geklappt.')
    expect(result.current.isPending).toBe(false)
  })

  it('derives the message from the error when given a function', async () => {
    const { result } = renderHook(() => useAsyncAction())
    await act(() =>
      result.current.run(
        () => Promise.reject(new Error('409')),
        (err) => `Grund: ${(err as Error).message}`,
      ),
    )
    expect(result.current.error).toBe('Grund: 409')
  })

  it('clears an earlier error when the next run starts', async () => {
    const { result } = renderHook(() => useAsyncAction())
    act(() => result.current.setError('Eingabe prüfen.'))
    expect(result.current.error).toBe('Eingabe prüfen.')

    let finish: () => void = () => {}
    let running: Promise<void> = Promise.resolve()
    act(() => {
      running = result.current.run(() => new Promise<void>((resolve) => (finish = resolve)), 'Fehler')
    })
    expect(result.current.error).toBeNull()
    await act(async () => {
      finish()
      await running
    })
  })
})
