import { NavLink } from 'react-router-dom'

import { HEADER_LINK, HEADER_LINK_ACTIVE } from './headerLink'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? HEADER_LINK_ACTIVE : HEADER_LINK
}

// Content links in the logged-out header (Header's default nav); logged in, the same pages sit
// in the "Menü" (AccountMenu), with the same labels in the same order. Keeps the footer
// (LegalFooter) down to the legal links.
export function MarketingLinks() {
  return (
    <>
      <NavLink to="/exam-process" className={navLinkClass}>
        Prüfungsablauf
      </NavLink>
      <NavLink to="/pricing" className={navLinkClass}>
        Tokens
      </NavLink>
      <NavLink to="/faq" className={navLinkClass}>
        FAQ
      </NavLink>
    </>
  )
}
