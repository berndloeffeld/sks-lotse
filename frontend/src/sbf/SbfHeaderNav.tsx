import { NavLink } from 'react-router-dom'

import { HEADER_LINK, HEADER_LINK_ACTIVE } from '../components/headerLink'
import { sbfNavigationOpen } from '../siteConfig'

// The SBF site's header links (ADR-0067). No "Anmelden" yet: accounts come to SBF Lotse later, and
// until then the SBF build makes no API call at all, so the place only says "bald".
export function SbfHeaderNav() {
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
      <span className="py-1 font-mono text-xs tracking-wide text-surface-alt uppercase">Anmelden · bald</span>
    </nav>
  )
}
