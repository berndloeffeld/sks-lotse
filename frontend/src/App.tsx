import { Suspense, lazy, useEffect, type ComponentType } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { ExamProcessPage } from './pages/ExamProcessPage'
import { chartExercisesForGuests } from './chartCatalog'
import { ChartExercisePage } from './pages/ChartExercisePage'
import { ChartExercisesPage } from './pages/ChartExercisesPage'
import { AgbPage } from './pages/AgbPage'
import { FaqPage } from './pages/FaqPage'
import { ImprintPage } from './pages/ImprintPage'
import { LandingPage } from './pages/LandingPage'
import { LearnPage } from './pages/LearnPage'
import { MaintenancePage } from './pages/MaintenancePage'
import { UnknownPathPage } from './pages/NotFoundPage'
import { PracticePage } from './pages/PracticePage'
import { LoginPage } from './pages/LoginPage'
import { PricingPage } from './pages/PricingPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { AdScriptGate } from './routes/AdScriptGate'
import { AgbGate } from './routes/AgbGate'
import { ChartExercisesGate } from './routes/ChartExercisesGate'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useAdminWithoutAnalytics } from './hooks/useAdminWithoutAnalytics'
import { useNavigationScroll } from './hooks/useNavigationScroll'
import { useAuthStore } from './store/authStore'
import { useMaintenanceStore } from './store/maintenanceStore'

// Pages that are never prerendered (everything behind ProtectedRoute, whose prerender is just
// "Lädt…") load on demand, so a visitor of the landing page doesn't download the admin, exam and
// profile code. The prerendered public pages stay in the main bundle: a lazy one would not be
// there on hydration.
function lazyNamed<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => load().then((module) => ({ default: module[name] })))
}

const ChartAttemptPage = lazyNamed(() => import('./pages/ChartAttemptPage'), 'ChartAttemptPage')
const AdminLayout = lazyNamed(() => import('./components/AdminLayout'), 'AdminLayout')
const AdminBlocklistPage = lazyNamed(() => import('./pages/AdminBlocklistPage'), 'AdminBlocklistPage')
const AdminQuestionsPage = lazyNamed(() => import('./pages/AdminQuestionsPage'), 'AdminQuestionsPage')
const AdminSettingsPage = lazyNamed(() => import('./pages/AdminSettingsPage'), 'AdminSettingsPage')
const AdminUserPage = lazyNamed(() => import('./pages/AdminUserPage'), 'AdminUserPage')
const AdminUsersPage = lazyNamed(() => import('./pages/AdminUsersPage'), 'AdminUsersPage')
const ExamPage = lazyNamed(() => import('./pages/ExamPage'), 'ExamPage')
const ExamRunPage = lazyNamed(() => import('./pages/ExamRunPage'), 'ExamRunPage')
const FocusPracticePage = lazyNamed(() => import('./pages/FocusPracticePage'), 'FocusPracticePage')
const RefreshPracticePage = lazyNamed(() => import('./pages/RefreshPracticePage'), 'RefreshPracticePage')
const ProfileAccountPage = lazyNamed(() => import('./pages/ProfileAccountPage'), 'ProfileAccountPage')
const ProfileLearnStatusPage = lazyNamed(() => import('./pages/ProfileLearnStatusPage'), 'ProfileLearnStatusPage')
const ProfileLayout = lazyNamed(() => import('./components/ProfileLayout'), 'ProfileLayout')

function PageFallback() {
  return (
    <p role="status" className="p-8 text-ink-soft">
      Lädt…
    </p>
  )
}

function ThrowForPreview(): never {
  throw new Error('Error page preview')
}

// Former paths, redirected to their current route (public ones also in render.yaml).
const RETIRED_PATHS: Record<string, string> = {
  '/start': '/learn',
  '/agb': '/terms',
  '/ablauf': '/exam-process',
  '/preise': '/pricing',
  '/learn/fokus': '/learn/focus',
}

// Legal pages stay reachable during maintenance mode (§5 DDG Impressumspflicht) —
// everything else, including the landing page, shows MaintenancePage instead.
// Paths taken verbatim from the <Routes> below.
const MAINTENANCE_EXEMPT_PATHS = new Set(['/imprint', '/privacy', '/terms'])

// Everything below the router: the one route of the data router (appRoutes.tsx), so the client
// (main.tsx) and the build-time prerender (entry-server.tsx) render the same tree.
export function AppRoutes() {
  const checkSession = useAuthStore((state) => state.checkSession)
  const maintenanceMode = useMaintenanceStore((state) => state.maintenanceMode)
  const { pathname } = useLocation()
  const chartsOpen = chartExercisesForGuests()

  useEffect(() => {
    checkSession()
  }, [checkSession])

  useNavigationScroll()
  useAdminWithoutAnalytics()

  if (maintenanceMode && !MAINTENANCE_EXEMPT_PATHS.has(pathname)) {
    return <MaintenancePage />
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/imprint" element={<ImprintPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<AgbPage />} />
          <Route path="/exam-process" element={<ExamProcessPage />} />
          {/* The prerendered public pages above carry the ad script statically; these load it
            only where wanted — not for ads-removed accounts, never on /pricing or /admin (ads.ts).
            /pricing and the open /learn pages are prerendered without it, and the gate leaves a
            document that already runs it (arriving from a page with ads). */}
          <Route element={<AdScriptGate />}>
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/login" element={<LoginPage />} />
            {/* AgbGate only ever asks a logged-in learner; guests pass straight through. */}
            <Route element={<AgbGate />}>
              {/* Open without a login (ADR-0054): the topic list and a topic's run, prerendered for
                search engines; logged in they are the learner's Lernstand and graded run. */}
              <Route path="/learn" element={<LearnPage />} />
              <Route path="/learn/:subject/:topic" element={<PracticePage />} />
              {/* The Kartenaufgaben open without a login too, while the build's flag is "on"
                (ADR-0056): a guest runs a sheet in the page, nothing saved. */}
              {chartsOpen ? (
                <Route element={<ChartExercisesGate />}>
                  <Route path="/charts" element={<ChartExercisesPage />} />
                  <Route path="/charts/:number" element={<ChartExercisePage />} />
                </Route>
              ) : null}
              <Route element={<ProtectedRoute />}>
                <Route path="/learn/focus" element={<FocusPracticePage />} />
                <Route path="/learn/refresh" element={<RefreshPracticePage />} />
                <Route path="/exam" element={<ExamPage />} />
                <Route path="/exam/:id" element={<ExamRunPage />} />
                <Route element={<ChartExercisesGate />}>
                  {chartsOpen ? null : (
                    <>
                      <Route path="/charts" element={<ChartExercisesPage />} />
                      <Route path="/charts/:number" element={<ChartExercisePage />} />
                    </>
                  )}
                  <Route path="/charts/attempts/:id" element={<ChartAttemptPage />} />
                </Route>
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
          {/* Anything else says so, with a way back, instead of dropping the visitor on / unexplained. */}
          <Route path="*" element={<UnknownPathPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
