import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { loginState } from '../returnPath'
import { useAuthStore } from '../store/authStore'

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)
  const sessionError = useAuthStore((state) => state.sessionError)
  const checkSession = useAuthStore((state) => state.checkSession)
  const location = useLocation()

  if (isLoading) {
    return (
      <p role="status" className="p-8 text-ink-soft">
        Lädt…
      </p>
    )
  }

  if (sessionError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 p-8 text-ink-soft">
        <p>Der Server ist gerade nicht erreichbar. Deine Sitzung ist davon nicht betroffen.</p>
        <button type="button" onClick={() => void checkSession()} className="underline">
          Erneut versuchen
        </button>
      </div>
    )
  }

  // The login sends the learner back here afterwards (a deep link, or the page whose session ran out).
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={loginState(location)} />
  }

  return <Outlet />
}
