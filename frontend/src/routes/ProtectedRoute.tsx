import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { loginState } from '../returnPath'
import { useAuthStore } from '../store/authStore'
import { ErrorMessage } from '../components/Messages'

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
      <div className="p-8">
        <ErrorMessage onRetry={checkSession}>
          Der Server ist gerade nicht erreichbar. Deine Sitzung ist davon nicht betroffen.
        </ErrorMessage>
      </div>
    )
  }

  // The login sends the learner back here afterwards (a deep link, or the page whose session ran out).
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={loginState(location)} />
  }

  return <Outlet />
}
