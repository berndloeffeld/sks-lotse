import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { User } from '../api/types'
import { useAuthStore } from './authStore'

const mockUser: User = {
  id: 1,
  email: 'learner@example.com',
  created_at: '2026-01-01T00:00:00Z',
  exam_variant: null,
  is_admin: false,
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true })
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
