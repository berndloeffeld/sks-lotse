import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useApiQuery } from './useApiQuery'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useApiQuery', () => {
  it('loads on mount and reports loading until the data is there', async () => {
    const { result } = renderHook(() => useApiQuery('k', () => Promise.resolve(['a'])))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toEqual(['a'])
    expect(result.current.failed).toBe(false)
  })

  it('reports a failed load without data', async () => {
    const { result } = renderHook(() => useApiQuery('k', () => Promise.reject(new Error('down'))))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.failed).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('shows loading again for a new key and drops the older, slower answer', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const fetchers: Record<string, () => Promise<string>> = { a: () => first.promise, b: () => second.promise }
    const { result, rerender } = renderHook(({ key }) => useApiQuery(key, fetchers[key]), {
      initialProps: { key: 'a' },
    })

    rerender({ key: 'b' })
    expect(result.current.isLoading).toBe(true)
    await act(async () => second.resolve('for b'))
    await act(async () => first.resolve('for a'))

    expect(result.current.data).toBe('for b')
  })

  it('never shows the previous key’s data while the new key loads', async () => {
    const pending = deferred<string>()
    const { result, rerender } = renderHook(
      ({ key }) => useApiQuery(key, key === 'a' ? () => Promise.resolve('for a') : () => pending.promise),
      { initialProps: { key: 'a' } },
    )
    await waitFor(() => expect(result.current.data).toBe('for a'))

    rerender({ key: 'b' })

    expect(result.current.data).toBeUndefined()
    expect(result.current.isLoading).toBe(true)
  })

  it('ignores an answer that arrives after unmount', async () => {
    const pending = deferred<string>()
    const { unmount } = renderHook(() => useApiQuery('k', () => pending.promise))
    unmount()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await act(async () => pending.resolve('late'))

    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('ignores a failure that arrives after unmount', async () => {
    const pending = deferred<string>()
    const { unmount } = renderHook(() => useApiQuery('k', () => pending.promise))
    unmount()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await act(async () => pending.reject(new Error('late')))

    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('does not mistake a failure for a new key for the old key', async () => {
    const failing = deferred<string>()
    const { result, rerender } = renderHook(
      ({ key }) => useApiQuery(key, key === 'a' ? () => Promise.resolve('for a') : () => failing.promise),
      { initialProps: { key: 'a' } },
    )
    await waitFor(() => expect(result.current.data).toBe('for a'))
    rerender({ key: 'b' })
    // Back to "a" before "b" answered: b's late failure must not mark "a" as failed.
    rerender({ key: 'a' })
    await waitFor(() => expect(result.current.data).toBe('for a'))
    await act(async () => failing.reject(new Error('down')))

    expect(result.current.failed).toBe(false)
  })

  it('reloads in place with the latest fetcher, keeping the data on screen meanwhile', async () => {
    let value = 1
    const next = deferred<number>()
    const { result } = renderHook(() => useApiQuery('k', () => (value === 1 ? Promise.resolve(1) : next.promise)))
    await waitFor(() => expect(result.current.data).toBe(1))

    value = 2
    let done = false
    act(() => {
      void result.current.reload().then(() => {
        done = true
      })
    })
    expect(result.current.data).toBe(1)
    expect(result.current.isLoading).toBe(false)
    await act(async () => next.resolve(2))

    expect(result.current.data).toBe(2)
    expect(done).toBe(true)
  })

  it('keeps the data but flags a failed reload, and a later success clears the flag', async () => {
    let fail = false
    const { result } = renderHook(() =>
      useApiQuery('k', () => (fail ? Promise.reject(new Error('down')) : Promise.resolve('ok'))),
    )
    await waitFor(() => expect(result.current.data).toBe('ok'))

    fail = true
    await act(() => result.current.reload())
    expect(result.current.failed).toBe(true)
    expect(result.current.data).toBe('ok')

    fail = false
    await act(() => result.current.reload())
    expect(result.current.failed).toBe(false)
  })

  it('drops a reload that finishes after the key changed', async () => {
    const slow = deferred<string>()
    let calls = 0
    const { result, rerender } = renderHook(
      ({ key }) =>
        useApiQuery(key, () => {
          calls += 1
          if (key === 'a') return calls === 1 ? Promise.resolve('a1') : slow.promise
          return Promise.resolve('b1')
        }),
      { initialProps: { key: 'a' } },
    )
    await waitFor(() => expect(result.current.data).toBe('a1'))

    let reloading!: Promise<void>
    act(() => {
      reloading = result.current.reload()
    })
    rerender({ key: 'b' })
    await waitFor(() => expect(result.current.data).toBe('b1'))
    await act(async () => {
      slow.resolve('a2')
      await reloading
    })

    expect(result.current.data).toBe('b1')
  })

  it('drops a failed reload that finishes after the key changed', async () => {
    const slow = deferred<string>()
    let calls = 0
    const { result, rerender } = renderHook(
      ({ key }) =>
        useApiQuery(key, () => {
          calls += 1
          if (key === 'a') return calls === 1 ? Promise.resolve('a1') : slow.promise
          return Promise.resolve('b1')
        }),
      { initialProps: { key: 'a' } },
    )
    await waitFor(() => expect(result.current.data).toBe('a1'))

    let reloading!: Promise<void>
    act(() => {
      reloading = result.current.reload()
    })
    rerender({ key: 'b' })
    await waitFor(() => expect(result.current.data).toBe('b1'))
    await act(async () => {
      slow.reject(new Error('down'))
      await reloading
    })

    expect(result.current.failed).toBe(false)
  })

  it('swaps in fresher data a write returned, by value or by updater', async () => {
    const { result } = renderHook(() => useApiQuery('k', () => Promise.resolve({ n: 1 })))
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }))

    act(() => result.current.setData({ n: 2 }))
    expect(result.current.data).toEqual({ n: 2 })

    act(() => result.current.setData((current) => ({ n: current.n + 1 })))
    expect(result.current.data).toEqual({ n: 3 })
  })

  it('ignores setData before anything has loaded', () => {
    const pending = deferred<{ n: number }>()
    const { result } = renderHook(() => useApiQuery('k', () => pending.promise))

    act(() => result.current.setData({ n: 9 }))

    expect(result.current.data).toBeUndefined()
    expect(result.current.isLoading).toBe(true)
  })
})
