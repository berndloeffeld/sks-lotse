import { Route, Routes } from 'react-router-dom'

import { ErrorPageBody, RenderErrorBoundary } from '../components/RenderErrorBoundary'
import { useNavigationScroll } from '../hooks/useNavigationScroll'
import { ImprintContent } from '../legal/ImprintContent'
import { PrivacyContent } from '../legal/PrivacyContent'
import { sbfNavigationOpen } from '../siteConfig'
import { NavigationOverviewPage } from './NavigationOverviewPage'
import { NavigationTaskPage } from './NavigationTaskPage'
import { SbfFaqPage } from './SbfFaqPage'
import { SbfLandingPage } from './SbfLandingPage'
import { SbfNotFoundPage } from './SbfNotFoundPage'
import { SbfPageLayout } from './SbfPageLayout'

// The SBF site's routes (ADR-0067): public pages only. No session check, no AGB gate, no /admin and
// no login: until accounts come to SBF Lotse, the SBF build makes no API call at all — and carries
// none of SKS Lotse's session code (PageLayout, Header), only the parts both sites share.
export function SbfApp() {
  useNavigationScroll()
  return (
    <RenderErrorBoundary
      fallback={
        <SbfPageLayout title="Da ist etwas schiefgelaufen">
          <ErrorPageBody text="Beim Anzeigen dieser Seite ist ein unerwarteter Fehler aufgetreten. Lade die Seite neu." />
        </SbfPageLayout>
      }
    >
      <Routes>
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
        <Route path="*" element={<SbfNotFoundPage />} />
      </Routes>
    </RenderErrorBoundary>
  )
}
