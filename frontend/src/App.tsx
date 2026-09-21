import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AdminPage } from './pages/AdminPage'
import { ExamPage } from './pages/ExamPage'
import { ExamRunPage } from './pages/ExamRunPage'
import { FaqPage } from './pages/FaqPage'
import { ImprintPage } from './pages/ImprintPage'
import { LandingPage } from './pages/LandingPage'
import { LearnPage } from './pages/LearnPage'
import { PracticePage } from './pages/PracticePage'
import { LoginPage } from './pages/LoginPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { ProfilePage } from './pages/ProfilePage'
import { StartPage } from './pages/StartPage'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useAuthStore } from './store/authStore'

function ThrowForPreview(): never {
  throw new Error('Error page preview')
}

// Everything below the router, so the build-time prerender
// (entry-server.tsx) can render the same tree under a StaticRouter.
export function AppRoutes() {
  const checkSession = useAuthStore((state) => state.checkSession)

  useEffect(() => {
    checkSession()
  }, [checkSession])

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/imprint" element={<ImprintPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/start" element={<StartPage />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/learn/:subject/:topic" element={<PracticePage />} />
          <Route path="/exam" element={<ExamPage />} />
          <Route path="/exam/:id" element={<ExamRunPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        {/* Dev-only: throws on purpose to preview the ErrorBoundary's error
            page. import.meta.env.DEV is false in production builds, so this
            route isn't registered there. */}
        {import.meta.env.DEV ? <Route path="/_dev/error" element={<ThrowForPreview />} /> : null}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
