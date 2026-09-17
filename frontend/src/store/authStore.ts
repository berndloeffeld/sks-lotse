import { create } from 'zustand'

import { apiClient, setUnauthorizedHandler } from '../api/client'
import type { User } from '../api/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  // True until the initial GET /auth/me (see checkSession) resolves — lets
  // ProtectedRoute avoid redirecting to /login before that first check runs.
  isLoading: boolean
  // The only source of truth for "logged in" (ADR-0013) — never derived from
  // inspecting a token, since the frontend never holds one (ADR-0012).
  checkSession: () => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => {
  setUnauthorizedHandler(() => set({ user: null, isAuthenticated: false, isLoading: false }))

  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,
    checkSession: async () => {
      set({ isLoading: true })
      try {
        const user = await apiClient.get<User>('/auth/me')
        set({ user, isAuthenticated: true, isLoading: false })
      } catch {
        set({ user: null, isAuthenticated: false, isLoading: false })
      }
    },
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
