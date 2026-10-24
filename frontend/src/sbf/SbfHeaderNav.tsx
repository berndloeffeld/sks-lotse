import { NavLink } from 'react-router-dom'

import { LoginLink } from '../shared/components/LoginLink'
import { TokenCounter } from '../shared/components/TokenCounter'
import { HEADER_CTA, HEADER_LINK, HEADER_LINK_ACTIVE } from '../shared/components/headerLink'
import { sbfAccountsOpen, sbfNavigationOpen } from '../shared/siteConfig'
import { useAuthStore } from '../shared/store/authStore'
import { SbfAccountMenu } from './SbfAccountMenu'

// The SBF site's header links (ADR-0067). With accounts (VITE_SBF_ACCOUNTS=on, ADR-0070) the end of
// the bar is SKS Lotse's: "Anmelden" for a guest, the token balance and the Konto menu once signed
// in. Without, the place only says "bald".
export function SbfHeaderNav() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return (
    <nav className="ml-auto flex flex-wrap items-baseline justify-end gap-x-5 gap-y-2">
      {sbfNavigationOpen() ? (
        <NavLink to="/navigation" className={({ isActive }) => (isActive ? HEADER_LINK_ACTIVE : HEADER_LINK)}>
          Navigationsaufgaben
        </NavLink>
      ) : null}
      <NavLink to="/faq" className={({ isActive }) => (isActive ? HEADER_LINK_ACTIVE : HEADER_LINK)}>
        FAQ
      </NavLink>
      {!sbfAccountsOpen() ? (
        <span className="py-1 font-mono text-xs tracking-wide text-surface-alt uppercase">Anmelden · bald</span>
      ) : isAuthenticated ? (
        <>
          <TokenCounter />
          <SbfAccountMenu />
        </>
      ) : (
        <LoginLink place="header" className={HEADER_CTA}>
          Anmelden
        </LoginLink>
      )}
    </nav>
  )
}
