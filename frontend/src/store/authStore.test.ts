import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { User } from '../api/types'
import { useAuthStore } from './authStore'

const mockUser: User = {
  id: 1,
  email: 'learner@example.com',
  created_at: '2026-01-01T00:00:00Z',
  exam_variant: null,
  first_name: null,
  last_name: null,
  gender: null,
  ai_grading_enabled: false,
  is_admin: false,
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true, sessionError: false })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('checkSession sets the user on a successful /auth/me call', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(mockUser)))

    await useAuthStore.getState().checkSession()

    expect(useAuthStore.getState()).toMatchObject({ user: mockUser, isAuthenticated: true, isLoading: false })
  })

  it('checkSession clears the user when /auth/me is unauthorized', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'Not authenticated' }, 401)))

    await useAuthStore.getState().checkSession()

    expect(useAuthStore.getState()).toMatchObject({ user: null, isAuthenticated: false, isLoading: false })
  })

  it('checkSession flags a session error (not a logout) on a server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'boom' }, 503)))

    await useAuthStore.getState().checkSession()

    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: false, isLoading: false, sessionError: true })
  })

  it('checkSession flags a session error when the network is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await useAuthStore.getState().checkSession()

    expect(useAuthStore.getState().sessionError).toBe(true)
  })

  it('checkSession clears an earlier session error once the check succeeds', async () => {
    useAuthStore.setState({ sessionError: true })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(mockUser)))

    await useAuthStore.getState().checkSession()

    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, sessionError: false })
  })

  it('a 401 is a plain logout, not a session error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'Not authenticated' }, 401)))

    await useAuthStore.getState().checkSession()

    expect(useAuthStore.getState().sessionError).toBe(false)
  })

  it('setUser swaps the user without touching isLoading or isAuthenticated', () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, isLoading: false })

    useAuthStore.getState().setUser({ ...mockUser, first_name: 'Anna' })

    expect(useAuthStore.getState()).toMatchObject({
      user: { ...mockUser, first_name: 'Anna' },
      isAuthenticated: true,
      isLoading: false,
    })
  })

  it('updateUser PATCHes /auth/me and stores the returned user without a loading phase', async () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, isLoading: false })
    const updated = { ...mockUser, exam_variant: 'motor' }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(updated))
    vi.stubGlobal('fetch', fetchMock)
    const loadingStates: boolean[] = []
    const unsubscribe = useAuthStore.subscribe((state) => loadingStates.push(state.isLoading))

    await useAuthStore.getState().updateUser({ exam_variant: 'motor' })
    unsubscribe()

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/api\/v1\/auth\/me$/)
    expect(init).toMatchObject({ method: 'PATCH', body: JSON.stringify({ exam_variant: 'motor' }) })
    expect(useAuthStore.getState()).toMatchObject({ user: updated, isAuthenticated: true, isLoading: false })
    expect(loadingStates).not.toContain(true)
  })

  it('updateUser rejects and leaves the user untouched when the PATCH fails', async () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, isLoading: false })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'nope' }, 422)))

    await expect(useAuthStore.getState().updateUser({ first_name: 'x' })).rejects.toThrow()

    expect(useAuthStore.getState().user).toEqual(mockUser)
  })

  it('clearSession drops the user locally without calling the backend', () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, isLoading: false })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    useAuthStore.getState().clearSession()

    expect(useAuthStore.getState()).toMatchObject({ user: null, isAuthenticated: false, isLoading: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('logout clears the user after a successful /auth/logout call', async () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, isLoading: false })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    await useAuthStore.getState().logout()

    expect(useAuthStore.getState()).toMatchObject({ user: null, isAuthenticated: false })
  })

  it('logout clears local state even if the backend call fails', async () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, isLoading: false })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'Not authenticated' }, 401)))

    await useAuthStore.getState().logout()

    expect(useAuthStore.getState()).toMatchObject({ user: null, isAuthenticated: false })
  })
})
