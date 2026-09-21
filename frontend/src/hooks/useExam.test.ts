import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '../api/client'
import { useExam } from './useExam'

vi.mock('../api/client', () => ({ apiClient: { get: vi.fn() } }))

const get = vi.mocked(apiClient.get)
const exam = { id: 7 } as never

describe('useExam', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('loads the exam by id and stops loading', async () => {
    get.mockResolvedValue(exam)
    const { result } = renderHook(() => useExam('7'))
    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(get).toHaveBeenCalledWith('/exams/7')
    expect(result.current.exam).toBe(exam)
    expect(result.current.error).toBeNull()
  })

  it('reports an error, and stops loading, when the exam cannot be loaded', async () => {
    get.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useExam('7'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.exam).toBeNull()
    expect(result.current.error).toBe('Die Prüfung konnte nicht geladen werden.')
  })

  it('clears an earlier error when a reload succeeds', async () => {
    get.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(exam)
    const { result } = renderHook(() => useExam('7'))
    await waitFor(() => expect(result.current.error).not.toBeNull())

    await act(() => result.current.reload())

    expect(result.current.error).toBeNull()
    expect(result.current.exam).toBe(exam)
  })

  it('loads again when the id changes', async () => {
    get.mockResolvedValue(exam)
    const { rerender } = renderHook(({ id }) => useExam(id), { initialProps: { id: '7' } })
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1))

    rerender({ id: '8' })

    await waitFor(() => expect(get).toHaveBeenLastCalledWith('/exams/8'))
  })
})
