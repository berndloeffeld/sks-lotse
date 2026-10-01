import { NavLink } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { AccountMenu } from './AccountMenu'
import { TokenCounter } from './TokenCounter'
import { HEADER_LINK, HEADER_LINK_ACTIVE } from './headerLink'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? HEADER_LINK_ACTIVE : HEADER_LINK
}

// Header nav for logged-in pages: the learning destinations (the Kartenaufgaben only where the
// CHART_EXERCISES flag covers the account), then everything else behind the "Menü" button (AccountMenu).
export function AccountNav() {
  const chartExercises = useAuthStore((state) => state.user?.can_use_chart_exercises ?? false)
  return (
    <nav className="ml-auto flex flex-wrap items-baseline justify-end gap-x-5 gap-y-2">
      <NavLink to="/learn" className={navLinkClass}>
        Lernen
      </NavLink>
      <NavLink to="/exam" className={navLinkClass}>
        Prüfung
      </NavLink>
      {chartExercises ? (
        <NavLink to="/charts" className={navLinkClass}>
          Karte
        </NavLink>
      ) : null}
      <TokenCounter />
      <AccountMenu />
    </nav>
  )
}
