import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '../store/authStore'
import { useExamVariantUpdate } from './useExamVariantUpdate'

describe('useExamVariantUpdate', () => {
  const updateUser = vi.fn()

  beforeEach(() => {
    updateUser.mockReset()
    useAuthStore.setState({ updateUser })
  })

  it('saves the chosen variant, busy only while saving', async () => {
    let finish: () => void = () => {}
    updateUser.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)))
    const { result } = renderHook(() => useExamVariantUpdate())
    expect(result.current.isSaving).toBe(false)

    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = result.current.changeVariant('motor')
    })
    expect(result.current.isSaving).toBe(true)
    expect(updateUser).toHaveBeenCalledWith({ exam_variant: 'motor' })

    await act(async () => {
      finish()
      await pending
    })
    expect(result.current.isSaving).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('reports a failed save, and a later successful one clears the message', async () => {
    updateUser.mockRejectedValueOnce(new Error('nope')).mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useExamVariantUpdate())

    await act(() => result.current.changeVariant('motor'))
    expect(result.current.error).toBe('Die Prüfungsvariante konnte nicht gespeichert werden.')
    expect(result.current.isSaving).toBe(false)

    await act(() => result.current.changeVariant('segeln_und_motor'))
    expect(result.current.error).toBeNull()
  })
})
