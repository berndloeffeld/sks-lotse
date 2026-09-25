import { NavLink, Outlet } from 'react-router-dom'

import { formatDate, getDisplayName } from '../format'
import { useAuthStore } from '../store/authStore'
import { Band } from './Bands'
import { PageLayout } from './PageLayout'

// /profile's two sections. A new one is an entry here plus its route in App.tsx.
const TABS = [
  { to: '/profile', label: 'Lernstand', end: true },
  { to: '/profile/account', label: 'Konto', end: false },
]

const TAB = 'border-b-2 px-1 pb-2 font-mono text-sm tracking-wide uppercase'

// Shell for /profile and /profile/account: the title band with the learner's
// name, the Lernstand/Konto tabs (same pattern as AdminLayout's SECTIONS),
// and the section itself rendering into the <Outlet>.
export function ProfileLayout() {
  const user = useAuthStore((state) => state.user)

  if (!user) {
    return null
  }

  return (
    <PageLayout
      title="Profil"
      subtitle={
        <>
          Angemeldet als <span className="font-mono text-surface">{getDisplayName(user)}</span> · Mitglied seit{' '}
          {formatDate(user.created_at)}
        </>
      }
      bands
    >
      <Band className="pt-8 pb-0">
        <nav aria-label="Profilbereiche" className="flex gap-x-6 border-b border-border">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `${TAB} ${isActive ? 'border-ink text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </Band>
      <Outlet />
    </PageLayout>
  )
}
