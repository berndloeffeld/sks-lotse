import { Link, Route, Routes } from 'react-router-dom'

import { ErrorPageBody, RenderErrorBoundary } from '../components/RenderErrorBoundary'
import { buttonClass } from '../components/buttonStyles'
import { useNavigationScroll } from '../hooks/useNavigationScroll'
import { ImprintContent } from '../legal/ImprintContent'
import { PrivacyContent } from '../legal/PrivacyContent'
import { SbfFaqPage } from './SbfFaqPage'
import { SbfLandingPage } from './SbfLandingPage'
import { SbfPageLayout } from './SbfPageLayout'

function SbfNotFoundPage() {
  return (
    <SbfPageLayout title="Seite nicht gefunden" compact>
      <p className="text-ink">
        Unter dieser Adresse gibt es keine Seite. Vielleicht ist der Link veraltet oder vertippt.
      </p>
      <Link to="/" className={`${buttonClass('primary')} self-start`}>
        Zur Startseite
      </Link>
    </SbfPageLayout>
  )
}

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
