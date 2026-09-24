import { Link } from 'react-router-dom'

import { HEADER_LINK } from './headerLink'

// Content links every page's header carries, logged in or out (Header's default nav,
// AccountNav) — keeps the footer (LegalFooter) down to just the legally required links.
export function MarketingLinks() {
  return (
    <>
      <Link to="/faq" className={HEADER_LINK}>
        FAQ
      </Link>
      <Link to="/ablauf" className={HEADER_LINK}>
        Ablauf
      </Link>
      <Link to="/preise" className={HEADER_LINK}>
        Preise
      </Link>
    </>
  )
}
