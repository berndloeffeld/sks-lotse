import { Navigate, NavLink, Outlet } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
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
    </PageLayout>
  )
}
