import { NavLink, Outlet } from 'react-router-dom'

import { Band } from '../shared/components/Bands'
import { formatDate, getDisplayName } from '../shared/format'
import { useAuthStore } from '../shared/store/authStore'
import { SbfPageLayout } from './SbfPageLayout'

// /profile's sections on SBF Lotse, tabs like SKS Lotse's Lernstand | Konto. The runs of the
// Navigationsaufgaben come as their own tab with the saved runs.
const TABS = [{ to: '/profile/account', label: 'Konto' }]

const TAB = 'border-b-2 px-1 pb-2 font-mono text-sm tracking-wide uppercase'

export function SbfProfileLayout() {
  const user = useAuthStore((state) => state.user)

  if (!user) {
    return null
  }

  return (
    <SbfPageLayout
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
    </SbfPageLayout>
  )
}
