import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { createLazyExport } from '../lazyExport'
import { useLazyExport } from './useLazyExport'

describe('useLazyExport', () => {
  it('loads again on reload after a failed load', async () => {
    const importRaw = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue([1, 2])
    const source = createLazyExport(importRaw, (raw: number[]) => raw.length)
    const { result } = renderHook(() => useLazyExport(source))
    await waitFor(() => expect(result.current.failed).toBe(true))
    expect(result.current.data).toBeNull()

    await act(() => result.current.reload())

    expect(result.current).toMatchObject({ data: 2, failed: false })
    expect(importRaw).toHaveBeenCalledTimes(2)
  })

  it('stays failed when the reload fails too', async () => {
    const importRaw = vi.fn().mockRejectedValue(new Error('offline'))
    const source = createLazyExport(importRaw, (raw: number[]) => raw.length)
    const { result } = renderHook(() => useLazyExport(source))
    await waitFor(() => expect(result.current.failed).toBe(true))

    await act(() => result.current.reload())

    expect(result.current).toMatchObject({ data: null, failed: true })
    expect(importRaw).toHaveBeenCalledTimes(2)
  })
})
