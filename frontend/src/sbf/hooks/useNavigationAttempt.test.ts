import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '../../shared/store/authStore'
import { jsonResponse, makeUser } from '../../test/fixtures'
import type { SbfNavigationAttempt } from '../api/types'
import { useNavigationAttempt, useNavigationOverview } from './useNavigationAttempt'

function attempt(id: number, extra: Partial<SbfNavigationAttempt> = {}): SbfNavigationAttempt {
  return {
    id,
    task_number: 1,
    started_at: '2026-10-24T10:00:00Z',
    completed_at: null,
    subtask_count: 9,
    points: 0,
    current_subtask: 1,
    subtasks: [],
    ...extra,
  }
}

function overview(open: number | null) {
  return {
    pass_points: 7,
    tasks: [
      {
        number: 1,
        open_attempt_id: open,
        open_answered: open ? 1 : null,
        completed_count: 0,
        last_points: null,
        last_completed_at: null,
      },
    ],
  }
}

// A tiny backend: answers by method and path, and records what was asked.
function server(routes: Record<string, () => unknown>) {
  const calls: string[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'http://x').pathname.replace('/api/v1', '')
    const key = `${init?.method ?? 'GET'} ${path}`
    calls.push(key)
    const route = routes[key]
    return route ? jsonResponse(route()) : jsonResponse({ detail: 'not found' }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

describe('useNavigationAttempt', () => {
  afterEach(() => useAuthStore.setState(useAuthStore.getInitialState()))

  it('resumes the open run of the task', async () => {
    const calls = server({
      'GET /sbf-navigation': () => overview(5),
      'GET /sbf-navigation/attempts/5': () => attempt(5, { current_subtask: 2 }),
    })
    const { result } = renderHook(() => useNavigationAttempt(1))

    await waitFor(() => expect(result.current.attempt?.id).toBe(5))
    expect(calls).toEqual(['GET /sbf-navigation', 'GET /sbf-navigation/attempts/5'])
  })

  it('starts a run when none is open, and a new one on restart', async () => {
    let next = 8
    const calls = server({
      'GET /sbf-navigation': () => overview(null),
      'POST /sbf-navigation/1/attempts': () => attempt(next++),
    })
    const { result } = renderHook(() => useNavigationAttempt(1))
    await waitFor(() => expect(result.current.attempt?.id).toBe(8))

    act(() => result.current.restart())

    await waitFor(() => expect(result.current.attempt?.id).toBe(9))
    expect(calls.filter((call) => call.startsWith('POST'))).toHaveLength(2)
  })

  it('stores the answer and the point, each replacing the run', async () => {
    server({
      'GET /sbf-navigation': () => overview(5),
      'GET /sbf-navigation/attempts/5': () => attempt(5),
      'PUT /sbf-navigation/attempts/5/subtasks/1/answer': () =>
        attempt(5, {
          subtasks: [{ number: 1, answer_text: '079', point: null, ai_checkable: true, ai_suggestion: null }],
        }),
      'PUT /sbf-navigation/attempts/5/subtasks/1/point': () =>
        attempt(5, {
          points: 1,
          current_subtask: 2,
          subtasks: [{ number: 1, answer_text: '079', point: 1, ai_checkable: true, ai_suggestion: null }],
        }),
    })
    const { result } = renderHook(() => useNavigationAttempt(1))
    await waitFor(() => expect(result.current.attempt).not.toBeNull())

    await act(() => result.current.answer(1, '079'))
    expect(result.current.attempt?.subtasks[0].answer_text).toBe('079')
    await act(() => result.current.grade(1, true))
    expect(result.current.attempt?.current_subtask).toBe(2)
  })

  it('takes the balance left after a check into the account', async () => {
    useAuthStore.setState({ user: makeUser({ token_balance: 10 }), isAuthenticated: true, isLoading: false })
    const checked = attempt(5, {
      subtasks: [
        {
          number: 1,
          answer_text: '079',
          point: null,
          ai_checkable: true,
          ai_suggestion: { correct: true, feedback: 'Passt.', suspected_error: '' },
        },
      ],
    })
    server({
      'GET /sbf-navigation': () => overview(5),
      'GET /sbf-navigation/attempts/5': () => attempt(5),
      'POST /sbf-navigation/attempts/5/subtasks/1/ai-check': () => ({ attempt: checked, tokens_remaining: 8 }),
    })
    const { result } = renderHook(() => useNavigationAttempt(1))
    await waitFor(() => expect(result.current.attempt).not.toBeNull())

    await act(() => result.current.aiCheck(1))

    expect(result.current.attempt?.subtasks[0].ai_suggestion?.correct).toBe(true)
    expect(useAuthStore.getState().user?.token_balance).toBe(8)
  })
})

describe('useNavigationOverview', () => {
  it('loads the learner’s runs once', async () => {
    const calls = server({ 'GET /sbf-navigation': () => overview(3) })
    const { result } = renderHook(() => useNavigationOverview())
    await waitFor(() => expect(result.current.overview?.tasks[0].open_attempt_id).toBe(3))
    expect(calls).toEqual(['GET /sbf-navigation'])
  })
})
