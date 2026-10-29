import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'

import { ErrorPageBody, RenderErrorBoundary } from '../shared/components/RenderErrorBoundary'
import { useNavigationScroll } from '../shared/hooks/useNavigationScroll'
import { useUserRefreshOnReturn } from '../shared/hooks/useUserRefreshOnReturn'
import { AgbContent } from '../shared/legal/AgbContent'
import { ImprintContent } from '../shared/legal/ImprintContent'
import { PrivacyContent } from '../shared/legal/PrivacyContent'
import { ProfileAccountPage } from '../shared/pages/ProfileAccountPage'
import { AgbGate } from '../shared/routes/AgbGate'
import { ProtectedRoute } from '../shared/routes/ProtectedRoute'
import { sbfAccountsOpen, sbfNavigationOpen } from '../shared/siteConfig'
import { useAuthStore } from '../shared/store/authStore'
import { NavigationOverviewPage } from './NavigationOverviewPage'
import { NavigationTaskPage } from './NavigationTaskPage'
import { SbfFaqPage } from './SbfFaqPage'
import { SbfLandingPage } from './SbfLandingPage'
import { SbfLoginLinkPage } from './SbfLoginLinkPage'
import { SbfLoginPage } from './SbfLoginPage'
import { SbfNotFoundPage } from './SbfNotFoundPage'
import { SbfPageLayout } from './SbfPageLayout'
import { SbfPricingPage } from './SbfPricingPage'
import { SbfProfileLayout } from './SbfProfileLayout'
import { SbfRunsPage } from './SbfRunsPage'

// The session's routes, with accounts on SBF Lotse (VITE_SBF_ACCOUNTS=on, ADR-0070): the login, the
// profile and the token purchase, the parts both sites share in SBF Lotse's page. No /admin: that
// stays on sks-lotse.de.
function accountRoutes() {
  return (
    <>
      <Route path="/login" element={<SbfLoginPage />} />
      <Route path="/login/link" element={<SbfLoginLinkPage />} />
      <Route path="/pricing" element={<SbfPricingPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<SbfProfileLayout />}>
          <Route path="/profile" element={<SbfRunsPage />} />
          <Route path="/profile/account" element={<ProfileAccountPage />} />
        </Route>
      </Route>
    </>
  )
}

// The session, only with accounts: the check on start, and a fresh balance when the learner comes
// back to the tab. Without accounts the SBF build makes no API call at all.
function useSession() {
  const checkSession = useAuthStore((state) => state.checkSession)
  const accounts = sbfAccountsOpen()
  useEffect(() => {
    if (accounts) void checkSession()
  }, [accounts, checkSession])
  useUserRefreshOnReturn()
}

// The SBF site's routes (ADR-0067). With accounts (ADR-0070), every page sits in the AGB gate, which
// only ever asks a signed-in learner; a guest passes straight through.
export function SbfApp() {
  useNavigationScroll()
  useSession()
  return (
    <RenderErrorBoundary
      fallback={
        <SbfPageLayout title="Da ist etwas schiefgelaufen">
          <ErrorPageBody text="Beim Anzeigen dieser Seite ist ein unerwarteter Fehler aufgetreten. Lade die Seite neu." />
        </SbfPageLayout>
      }
    >
      <Routes>
        <Route element={<AgbGate />}>
          <Route path="/" element={<SbfLandingPage />} />
          <Route path="/faq" element={<SbfFaqPage />} />
          {/* The Navigationsaufgaben, open to guests, only in a build with VITE_SBF=on (ADR-0068). */}
          {sbfNavigationOpen() ? (
            <>
              <Route path="/navigation" element={<NavigationOverviewPage />} />
              <Route path="/navigation/:number" element={<NavigationTaskPage />} />
            </>
          ) : null}
          <Route
            path="/imprint"
            element={
              <SbfPageLayout title="Impressum">
                <ImprintContent />
              </SbfPageLayout>
            }
          />
          <Route
            path="/privacy"
            element={
              <SbfPageLayout title="Datenschutzerklärung">
                <PrivacyContent />
              </SbfPageLayout>
            }
          />
          <Route
            path="/terms"
            element={
              <SbfPageLayout title="AGB">
                <AgbContent />
              </SbfPageLayout>
            }
          />
          {sbfAccountsOpen() ? accountRoutes() : null}
          <Route path="*" element={<SbfNotFoundPage />} />
        </Route>
      </Routes>
    </RenderErrorBoundary>
  )
}
