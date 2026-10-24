import { Navigate, useLocation } from 'react-router-dom'

import { LoginForm } from '../shared/components/LoginForm'
import { safeReturnPath } from '../shared/returnPath'
import { useAuthStore } from '../shared/store/authStore'
import { SbfPageLayout } from './SbfPageLayout'

export function SbfLoginPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const location = useLocation()

  // Signed in — just now or already: back to where the login was asked for.
  if (isAuthenticated) {
    return <Navigate to={safeReturnPath(location.state)} replace />
  }

  return (
    <SbfPageLayout title="Anmelden" width="sm">
      <LoginForm />
      <p className="text-sm text-ink-soft">Hast du ein Konto bei SKS Lotse, gilt es auch hier.</p>
    </SbfPageLayout>
  )
}
