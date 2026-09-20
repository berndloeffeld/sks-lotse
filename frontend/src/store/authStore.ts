import { create } from 'zustand'

import { ApiError, apiClient, setUnauthorizedHandler } from '../api/client'
import type { User } from '../api/types'

// The PATCH /auth/me body — mirrors backend/app/schemas/auth.py::UserUpdate.
export type UserUpdate = Partial<Pick<User, 'exam_variant' | 'first_name' | 'last_name' | 'gender'>>

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  // True until the initial GET /auth/me (see checkSession) resolves — lets
  // ProtectedRoute avoid redirecting to /login before that first check runs.
  isLoading: boolean
  // True when the last checkSession failed for a reason other than "no valid
  // session" (network down, 5xx). The session may well still be valid, so
  // ProtectedRoute offers a retry instead of bouncing the learner to /login.
  sessionError: boolean
  // The only source of truth for "logged in" (ADR-0013) — never derived from
  // inspecting a token, since the frontend never holds one (ADR-0012).
  checkSession: () => Promise<void>
  // For an already-authenticated session: swap in a fresh User (e.g. from an
  // endpoint that returns UserRead) without touching isLoading. checkSession
  // is the wrong tool there — flipping isLoading makes ProtectedRoute unmount
  // the current page mid-save, dropping its local state.
  setUser: (user: User) => void
  updateUser: (patch: UserUpdate) => Promise<void>
  // Local-only: for when the backend session is already gone (e.g. the
  // account was just deleted), so there's nothing for /auth/logout to do.
  clearSession: () => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => {
  const clearSession = () => set({ user: null, isAuthenticated: false, isLoading: false, sessionError: false })
  setUnauthorizedHandler(clearSession)

  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,
    sessionError: false,
    checkSession: async () => {
      set({ isLoading: true, sessionError: false })
      try {
        const user = await apiClient.get<User>('/auth/me')
        set({ user, isAuthenticated: true, isLoading: false })
      } catch (error) {
        // Only a 401 means "logged out" (the client's unauthorized handler has
        // already cleared the session by then); anything else is a failed check.
        const unauthorized = error instanceof ApiError && error.status === 401
        set({ user: null, isAuthenticated: false, isLoading: false, sessionError: !unauthorized })
      }
    },
    setUser: (user) => set({ user }),
    updateUser: async (patch) => {
      const user = await apiClient.patch<User>('/auth/me', patch)
      set({ user })
    },
    clearSession,
    logout: async () => {
      try {
        await apiClient.post('/auth/logout')
      } catch {
        // Session was already invalid — fall through and clear local state
        // regardless, there's nothing else to undo.
      }
      set({ user: null, isAuthenticated: false })
    },
  }
})
