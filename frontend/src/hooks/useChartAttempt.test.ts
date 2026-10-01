import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '../api/client'
import { chartTask, makeChartAttempt, makeChartOverview } from '../test/fixtures'
import { useChartAttempt, useChartOverview } from './useChartAttempt'

vi.mock('../api/client', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }))

const get = vi.mocked(apiClient.get)
const put = vi.mocked(apiClient.put)

describe('useChartOverview', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('loads the ten exercises', async () => {
    const overview = makeChartOverview()
    get.mockResolvedValue(overview)
    const { result } = renderHook(() => useChartOverview())
    expect(result.current.overview).toBeNull()

    await waitFor(() => expect(result.current.overview).toBe(overview))

    expect(get).toHaveBeenCalledWith('/chart-exercises')
    expect(result.current.error).toBeNull()
  })

  it('reports an error when they cannot be loaded', async () => {
    get.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useChartOverview())

    await waitFor(() => expect(result.current.error).toBe('Die Kartenaufgaben konnten nicht geladen werden.'))
    expect(result.current.overview).toBeNull()
  })
})

describe('useChartAttempt', () => {
  beforeEach(() => {
    get.mockReset()
    put.mockReset()
  })

  it('loads the run by id', async () => {
    const attempt = makeChartAttempt()
    get.mockResolvedValue(attempt)
    const { result } = renderHook(() => useChartAttempt('5'))
    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(get).toHaveBeenCalledWith('/chart-exercises/attempts/5')
    expect(result.current.attempt).toBe(attempt)
    expect(result.current.error).toBeNull()
  })

  it('reports an error when the run cannot be loaded', async () => {
    get.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useChartAttempt('5'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.attempt).toBeNull()
    expect(result.current.error).toBe('Die Kartenaufgabe konnte nicht geladen werden.')
  })

  it('stores an answer and takes the returned run', async () => {
    get.mockResolvedValue(makeChartAttempt())
    const answered = makeChartAttempt({ tasks: [chartTask(1, { answer_text: 'HWZ 08:53' })] })
    put.mockResolvedValue(answered)
    const { result } = renderHook(() => useChartAttempt('5'))
    await waitFor(() => expect(result.current.attempt).not.toBeNull())

    await act(() => result.current.answer(1, 'HWZ 08:53'))

    expect(put).toHaveBeenCalledWith('/chart-exercises/attempts/5/tasks/1/answer', { answer_text: 'HWZ 08:53' })
    expect(result.current.attempt).toBe(answered)
  })

  it('stores points and takes the returned run', async () => {
    get.mockResolvedValue(makeChartAttempt())
    const next = makeChartAttempt({ current_task: 2, points: 2 })
    put.mockResolvedValue(next)
    const { result } = renderHook(() => useChartAttempt('5'))
    await waitFor(() => expect(result.current.attempt).not.toBeNull())

    await act(() => result.current.awardPoints(1, 2))

    expect(put).toHaveBeenCalledWith('/chart-exercises/attempts/5/tasks/1/points', { points: 2 })
    expect(result.current.attempt).toBe(next)
  })

  it('passes a failed write on to the caller and keeps the loaded run', async () => {
    const attempt = makeChartAttempt()
    get.mockResolvedValue(attempt)
    put.mockRejectedValue(new Error('409'))
    const { result } = renderHook(() => useChartAttempt('5'))
    await waitFor(() => expect(result.current.attempt).not.toBeNull())

    await expect(result.current.answer(1, 'x')).rejects.toThrow('409')
    expect(result.current.attempt).toBe(attempt)
  })
})
