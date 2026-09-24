import { Link } from 'react-router-dom'

import { HEADER_LINK } from './headerLink'

// Content links in the logged-out header (Header's default nav); logged in, the same pages sit
// in the "Menü" (AccountMenu). Keeps the footer (LegalFooter) down to the legal links.
export function MarketingLinks() {
  return (
    <>
      <Link to="/faq" className={HEADER_LINK}>
        FAQ
      </Link>
      <Link to="/exam-process" className={HEADER_LINK}>
        Ablauf
      </Link>
      <Link to="/pricing" className={HEADER_LINK}>
        Preise
      </Link>
    </>
  )
}
