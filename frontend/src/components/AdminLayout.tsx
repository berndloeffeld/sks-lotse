import { Navigate, NavLink, Outlet } from 'react-router-dom'

import { useAdminMfaStatus } from '../hooks/useAdminMfaStatus'
import { useAuthStore } from '../store/authStore'
import { AdminMfaEnrol, AdminMfaVerify } from './AdminMfa'
import { PageLayout } from './PageLayout'

// The admin area's sections. A new admin page is one entry here plus its route in App.tsx.
const SECTIONS = [
  { to: '/admin/users', label: 'Benutzer' },
  { to: '/admin/questions', label: 'Fragen' },
  { to: '/admin/blocklist', label: 'Sperrliste' },
  { to: '/admin/settings', label: 'Einstellungen' },
]

const TAB = 'border-b-2 px-1 pb-2 font-mono text-sm tracking-wide uppercase'

// Shell for every /admin page: the admin check (once, for all of them), the title band and the
// section tabs; the page itself renders into the <Outlet>.
export function AdminLayout() {
  const user = useAuthStore((state) => state.user)

  // Admin status comes from the already-loaded session (ProtectedRoute has already waited for
  // checkSession) — no separate loading state needed here.
  if (!user?.is_admin) {
    return <Navigate to="/learn" replace />
  }

  return (
    <PageLayout title="Admin" compact>
      <AdminArea />
    </PageLayout>
  )
}

// The second factor (ADR-0047) comes before any admin page: set it up on the first visit, confirm a
// code on every later one. The admin pages only render once the session has passed the check.
function AdminArea() {
  const { status, failed, reload } = useAdminMfaStatus()

  if (failed) {
    return (
      <p role="alert" className="text-sm text-danger">
        Der Admin-Bereich konnte nicht geladen werden. Bitte die Seite neu laden.
      </p>
    )
  }
  if (!status) return <p className="text-sm text-ink-soft">Lädt …</p>
  if (!status.enrolled) return <AdminMfaEnrol onVerified={() => void reload()} />
  if (!status.verified) return <AdminMfaVerify onVerified={() => void reload()} />

  return (
    <>
      <nav aria-label="Admin-Bereiche" className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border">
        {SECTIONS.map((section) => (
          <NavLink
            key={section.to}
            to={section.to}
            className={({ isActive }) =>
              `${TAB} ${isActive ? 'border-ink text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`
            }
          >
            {section.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  )
}
