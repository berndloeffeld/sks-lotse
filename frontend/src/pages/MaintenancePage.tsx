import { PageLayout } from '../components/PageLayout'
import { useAuthStore } from '../store/authStore'

// Shown app-wide while the backend is in maintenance mode (app/core/maintenance.py),
// except on the three legal routes App.tsx keeps exempt. No plain reload button,
// unlike ErrorBoundary — a reload during an incident just hits the same 503 again.
// Instead, "Erneut prüfen" re-runs checkSession (same idea as ProtectedRoute's
// retry for sessionError): every non-exempt route is unmounted while this page
// shows, so nothing else would ever call the API again to notice maintenance
// mode has ended. No separate links to the legal pages either — PageLayout's
// LegalFooter already links Impressum/Datenschutz/AGB on every page, this one
// included.
export function MaintenancePage() {
  const checkSession = useAuthStore((state) => state.checkSession)

  return (
    <PageLayout title="Wartungsarbeiten" nav="none">
      <p className="text-ink-soft">
        SKS Lotse befindet sich aktuell im Wartungsmodus. Wir sind in Kürze wieder erreichbar – dein Lernfortschritt
        bleibt dabei unverändert erhalten.
      </p>
      <button type="button" onClick={() => void checkSession()} className="self-start underline">
        Erneut prüfen
      </button>
    </PageLayout>
  )
}
