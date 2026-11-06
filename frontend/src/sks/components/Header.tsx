import type { ReactNode } from 'react'

import { HeaderBar } from './HeaderBar'
import { HEADER_CTA } from './headerLink'
import { LoginLink } from './LoginLink'
import { MarketingLinks } from './MarketingLinks'

interface HeaderProps {
  // Where the brand links to: `/` when logged out, `/learn` when logged in.
  homeTo?: string
  // Right-hand side; defaults to the marketing links plus "Anmelden" (logged-out pages).
  // Pass `null` for none (the login page itself).
  nav?: ReactNode
}

// SKS Lotse's header: the bar (HeaderBar) with the marketing links plus "Anmelden" by default.
export function Header({ homeTo = '/', nav }: HeaderProps) {
  return (
    <HeaderBar
      homeTo={homeTo}
      nav={
        nav === undefined ? (
          <nav className="ml-auto flex flex-wrap items-baseline justify-end gap-x-5 gap-y-2">
            <MarketingLinks />
            <LoginLink place="header" className={HEADER_CTA}>
              Anmelden
            </LoginLink>
          </nav>
        ) : (
          nav
        )
      }
    />
  )
}
