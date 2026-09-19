import { Navigate } from 'react-router-dom'

import { LoginForm } from '../components/LoginForm'
import { PageLayout } from '../components/PageLayout'
import { useAuthStore } from '../store/authStore'

export function LoginPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  // Already signed in (e.g. back button after a prior login) — skip the form.
  if (isAuthenticated) {
    return <Navigate to="/start" replace />
  }

  return (
    <PageLayout title="Anmelden" nav="none" width="sm">
      <LoginForm />
    </PageLayout>
  )
}
