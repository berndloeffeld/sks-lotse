import { NavLink } from 'react-router-dom'

import { HEADER_LINK, HEADER_LINK_ACTIVE } from './headerLink'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? HEADER_LINK_ACTIVE : HEADER_LINK
}

// Content links in the logged-out header (Header's default nav), led by the topics open to
// practise without a login (ADR-0054). Logged in, Prüfungsablauf and FAQ
// are in the footer (LegalFooter) and the prices behind the token balance and the Konto menu.
export function MarketingLinks() {
  return (
    <>
      <NavLink to="/learn" className={navLinkClass}>
        Lernen
      </NavLink>
      <NavLink to="/exam-process" className={navLinkClass}>
        Prüfungsablauf
      </NavLink>
      <NavLink to="/pricing" className={navLinkClass}>
        Preise
      </NavLink>
      <NavLink to="/faq" className={navLinkClass}>
        FAQ
      </NavLink>
    </>
  )
}
