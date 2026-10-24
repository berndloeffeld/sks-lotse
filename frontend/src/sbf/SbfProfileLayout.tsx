import { NavLink, Outlet } from 'react-router-dom'

import { Band } from '../shared/components/Bands'
import { formatDate, getDisplayName } from '../shared/format'
import { useAuthStore } from '../shared/store/authStore'
import { SbfPageLayout } from './SbfPageLayout'

// /profile's sections on SBF Lotse, tabs like SKS Lotse's Lernstand | Konto: the saved runs of the
// Navigationsaufgaben (ADR-0071) and the account.
const TABS = [
  { to: '/profile', label: 'Läufe', end: true },
  { to: '/profile/account', label: 'Konto', end: false },
]

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
    </SbfPageLayout>
  )
}
