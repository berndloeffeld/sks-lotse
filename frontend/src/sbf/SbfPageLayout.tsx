import { HeaderBar } from '../shared/components/HeaderBar'
import { PageShell, type PageShellProps } from '../shared/components/PageShell'
import { SessionExpiredNotice } from '../shared/components/SessionExpiredNotice'
import { sbfAccountsOpen } from '../shared/siteConfig'
import { useMaintenanceStore } from '../shared/store/maintenanceStore'
import { SbfHeaderNav } from './SbfHeaderNav'

// While the backend is in maintenance mode, a guest still practises in the page; only what needs the
// API (signing in, saving) is out of order, so SBF Lotse says so above the page instead of SKS
// Lotse's maintenance page.
function MaintenanceNotice() {
  const maintenanceMode = useMaintenanceStore((state) => state.maintenanceMode)
  if (!maintenanceMode) return null
  return (
    <div role="status" className="border-b border-border bg-surface-alt">
      <p className="mx-auto w-full max-w-4xl px-4 py-3 text-sm text-ink">
        Wartungsarbeiten: Anmelden und Speichern gehen gerade nicht. Üben kannst du weiter.
      </p>
    </div>
  )
}

// The SBF site's page (ADR-0067): the shared shell with the SBF links, and with accounts
// (ADR-0070) the notices of an expired session and of maintenance.
export function SbfPageLayout(props: PageShellProps) {
  return (
    <PageShell
      {...props}
      header={<HeaderBar homeTo="/" nav={<SbfHeaderNav />} />}
      notice={
        sbfAccountsOpen() ? (
          <>
            <SessionExpiredNotice />
            <MaintenanceNotice />
          </>
        ) : undefined
      }
    />
  )
}
