import { NavLink } from 'react-router-dom'

import { AccountMenu } from './AccountMenu'
import { TokenCounter } from './TokenCounter'
import { HEADER_LINK, HEADER_LINK_ACTIVE } from './headerLink'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? HEADER_LINK_ACTIVE : HEADER_LINK
}

// Header nav for logged-in pages: the two learning destinations, then everything else behind
// the "Menü" button (AccountMenu).
export function AccountNav() {
  return (
    <nav className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
      <NavLink to="/learn" className={navLinkClass}>
        Lernen
      </NavLink>
      <NavLink to="/exam" className={navLinkClass}>
        Prüfung
      </NavLink>
      <TokenCounter />
      <AccountMenu />
    </nav>
  )
}
