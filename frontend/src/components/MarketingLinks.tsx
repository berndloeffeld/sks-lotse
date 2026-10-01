import { NavLink } from 'react-router-dom'

import { chartExercisesForGuests } from '../chartCatalog'
import { HEADER_LINK, HEADER_LINK_ACTIVE } from './headerLink'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? HEADER_LINK_ACTIVE : HEADER_LINK
}

// Content links in the logged-out header (Header's default nav), led by what is open to practise
// without a login: the topics (ADR-0054) and, while their flag is "on", the Kartenaufgaben
// (ADR-0056), then the prices. Prüfungsablauf and FAQ are in the footer (LegalFooter), for guests
// and learners alike; logged in, the prices sit behind the token balance and the Konto menu.
export function MarketingLinks() {
  return (
    <>
      <NavLink to="/learn" className={navLinkClass}>
        Lernen
      </NavLink>
      {chartExercisesForGuests() ? (
        <NavLink to="/charts" className={navLinkClass}>
          Kartenaufgaben
        </NavLink>
      ) : null}
      <NavLink to="/pricing" className={navLinkClass}>
        Preise
      </NavLink>
    </>
  )
}
