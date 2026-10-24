import { Navigate, useLocation } from 'react-router-dom'

import { LoginForm } from '../components/LoginForm'
import { PageLayout } from '../components/PageLayout'
import { safeReturnPath } from '../returnPath'
import { useAuthStore } from '../store/authStore'

export function LoginPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const location = useLocation()

  // Signed in — just now (the form unmounts as the session arrives, so this is the redirect that
  // happens) or already (back button after a prior login): back to where the login was asked for.
  if (isAuthenticated) {
    return <Navigate to={safeReturnPath(location.state)} replace />
  }

  return (
    <PageLayout title="Anmelden" nav="none" width="sm">
      <LoginForm />
    </PageLayout>
  )
}
