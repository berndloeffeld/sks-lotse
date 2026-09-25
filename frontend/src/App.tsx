import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { ExamProcessPage } from './pages/ExamProcessPage'
import { AdminBlocklistPage } from './pages/AdminBlocklistPage'
import { AdminQuestionsPage } from './pages/AdminQuestionsPage'
import { AdminSettingsPage } from './pages/AdminSettingsPage'
import { AdminUserPage } from './pages/AdminUserPage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { AgbPage } from './pages/AgbPage'
import { ExamPage } from './pages/ExamPage'
import { ExamRunPage } from './pages/ExamRunPage'
import { FaqPage } from './pages/FaqPage'
import { FocusPracticePage } from './pages/FocusPracticePage'
import { ImprintPage } from './pages/ImprintPage'
import { LandingPage } from './pages/LandingPage'
import { LearnPage } from './pages/LearnPage'
import { MaintenancePage } from './pages/MaintenancePage'
import { PracticePage } from './pages/PracticePage'
import { LoginPage } from './pages/LoginPage'
import { PricingPage } from './pages/PricingPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { ProfileAccountPage } from './pages/ProfileAccountPage'
import { ProfileLearnStatusPage } from './pages/ProfileLearnStatusPage'
import { AdScriptGate } from './routes/AdScriptGate'
import { AgbGate } from './routes/AgbGate'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AdminLayout } from './components/AdminLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ProfileLayout } from './components/ProfileLayout'
import { useNavigationScroll } from './hooks/useNavigationScroll'
import { useAuthStore } from './store/authStore'
import { useMaintenanceStore } from './store/maintenanceStore'

function ThrowForPreview(): never {
  throw new Error('Error page preview')
}

// Legal pages stay reachable during maintenance mode (§5 DDG Impressumspflicht) —
// everything else, including the landing page, shows MaintenancePage instead.
// Paths taken verbatim from the <Routes> below.
const RETIRED_PATHS: Record<string, string> = {
  '/start': '/learn',
  '/agb': '/terms',
  '/ablauf': '/exam-process',
  '/preise': '/pricing',
  '/learn/fokus': '/learn/focus',
}

const MAINTENANCE_EXEMPT_PATHS = new Set(['/imprint', '/privacy', '/terms'])

// Everything below the router, so the build-time prerender
// (entry-server.tsx) can render the same tree under a StaticRouter.
export function AppRoutes() {
  const checkSession = useAuthStore((state) => state.checkSession)
  const maintenanceMode = useMaintenanceStore((state) => state.maintenanceMode)
  const { pathname } = useLocation()

  useEffect(() => {
    checkSession()
  }, [checkSession])

  useNavigationScroll()

  if (maintenanceMode && !MAINTENANCE_EXEMPT_PATHS.has(pathname)) {
    return <MaintenancePage />
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/imprint" element={<ImprintPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<AgbPage />} />
        <Route path="/exam-process" element={<ExamProcessPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        {/* The prerendered public pages above carry the ad script statically; these load it
            only where wanted — not for ads-removed accounts, never on /admin (ads.ts). */}
        <Route element={<AdScriptGate />}>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AgbGate />}>
              <Route path="/learn" element={<LearnPage />} />
              <Route path="/learn/focus" element={<FocusPracticePage />} />
              <Route path="/learn/:subject/:topic" element={<PracticePage />} />
              <Route path="/exam" element={<ExamPage />} />
              <Route path="/exam/:id" element={<ExamRunPage />} />
              <Route path="/profile" element={<ProfileLayout />}>
                <Route index element={<ProfileLearnStatusPage />} />
                <Route path="account" element={<ProfileAccountPage />} />
              </Route>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="users" replace />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="users/:id" element={<AdminUserPage />} />
                <Route path="questions" element={<AdminQuestionsPage />} />
                <Route path="blocklist" element={<AdminBlocklistPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>
            </Route>
          </Route>
        </Route>
        {/* Dev-only: throws on purpose to preview the ErrorBoundary's error
            page. import.meta.env.DEV is false in production builds, so this
            route isn't registered there. */}
        {import.meta.env.DEV ? <Route path="/_dev/error" element={<ThrowForPreview />} /> : null}
        {/* Retired paths, kept for bookmarks and old links: the post-login overview /learn replaced,
            and the German paths that became English (render.yaml answers the public ones with a 301
            before the app even loads). */}
        {Object.entries(RETIRED_PATHS).map(([from, to]) => (
          <Route key={from} path={from} element={<Navigate to={to} replace />} />
        ))}
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
