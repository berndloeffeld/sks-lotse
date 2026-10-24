import { create } from 'zustand'

import { ApiError, apiClient, setUnauthorizedHandler } from '../api/client'
import type { User } from '../api/types'

// The PATCH /auth/me body — mirrors backend/app/schemas/auth.py::UserUpdate.
export type UserUpdate = Partial<
  Pick<User, 'exam_variant' | 'first_name' | 'last_name' | 'gender' | 'exam_counts_for_progress'>
>

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
  // True once a request found the session of a learner who was signed in gone (a 401): the pages
  // say so (PageLayout) instead of silently turning into the guest's. Cleared by the next login or
  // dismissSessionExpired.
  sessionExpired: boolean
  dismissSessionExpired: () => void
  // The only source of truth for "logged in" (ADR-0013) — never derived from
  // inspecting a token, since the frontend never holds one (ADR-0012).
  checkSession: () => Promise<void>
  // For an already-authenticated session: swap in a fresh User (e.g. from an
  // endpoint that returns UserRead) without touching isLoading. checkSession
  // is the wrong tool there — flipping isLoading makes ProtectedRoute unmount
  // the current page mid-save, dropping its local state.
  setUser: (user: User) => void
  // Re-reads GET /auth/me for a learner who is signed in, in place (no isLoading, like setUser):
  // another tab or device may have changed the account since, e.g. the exam variant, which the
  // server already filters by. A failed refresh keeps the user as is; a 401 ends the session
  // through the client's unauthorized handler like any other request.
  refreshUser: () => Promise<void>
  updateUser: (patch: UserUpdate) => Promise<void>
  // Local-only: for when the backend session is already gone (e.g. the
  // account was just deleted), so there's nothing for /auth/logout to do.
  clearSession: () => void
  logout: () => Promise<void>
}

// What a site keeps of a learner in this browser, outside the session (SKS Lotse: the Formblatt of
// the Kartenaufgaben). Forgotten on logout and after deleting the account, so a shared device keeps
// nothing of the person who used it. Each site registers its own when it starts.
const browserDataCleanups = new Set<() => void>()

export function registerBrowserDataCleanup(cleanup: () => void) {
  browserDataCleanups.add(cleanup)
}

export function forgetBrowserData() {
  for (const cleanup of browserDataCleanups) cleanup()
}

export const useAuthStore = create<AuthState>((set, get) => {
  const clearSession = () => set({ user: null, isAuthenticated: false, isLoading: false, sessionError: false })
  // A 401 during logout() means the same thing as the logout itself: nothing to point out.
  let loggingOut = false
  setUnauthorizedHandler(() => {
    set((state) => ({ sessionExpired: state.sessionExpired || (state.isAuthenticated && !loggingOut) }))
    clearSession()
  })

  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,
    sessionError: false,
    sessionExpired: false,
    dismissSessionExpired: () => set({ sessionExpired: false }),
    checkSession: async () => {
      set({ isLoading: true, sessionError: false })
      try {
        const user = await apiClient.get<User>('/auth/me')
        set({ user, isAuthenticated: true, isLoading: false, sessionExpired: false })
      } catch (error) {
        // Only a 401 means "logged out" (the client's unauthorized handler has
        // already cleared the session by then); anything else is a failed check.
        const unauthorized = error instanceof ApiError && error.status === 401
        set({ user: null, isAuthenticated: false, isLoading: false, sessionError: !unauthorized })
      }
    },
    setUser: (user) => set({ user }),
    refreshUser: async () => {
      if (!get().isAuthenticated) return
      let user: User
      try {
        user = await apiClient.get<User>('/auth/me')
      } catch {
        return
      }
      // Logged out meanwhile (or the 401 handler ran): don't sign the learner back in.
      if (get().isAuthenticated) set({ user })
    },
    updateUser: async (patch) => {
      const user = await apiClient.patch<User>('/auth/me', patch)
      set({ user })
    },
    clearSession,
    logout: async () => {
      loggingOut = true
      try {
        await apiClient.post('/auth/logout')
      } catch {
        // Session was already invalid — fall through and clear local state
        // regardless, there's nothing else to undo.
      } finally {
        loggingOut = false
      }
      // Whoever uses this browser next must not find this learner's data in it.
      forgetBrowserData()
      set({ user: null, isAuthenticated: false, sessionExpired: false })
    },
  }
})
