import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { HEADER_CTA } from './headerLink'
import { Logo } from './Logo'
import { MarketingLinks } from './MarketingLinks'

interface HeaderProps {
  // Where the brand links to: `/` when logged out, `/learn` when logged in.
  homeTo?: string
  // Right-hand side; defaults to the marketing links plus "Anmelden" (logged-out pages).
  // Pass `null` for none (the login page itself).
  nav?: ReactNode
}

// Full-width primary-dark bar — the top band of every page's banded layout. Everything in it
// sits on one text baseline: the wordmark, the links and the bordered buttons' labels.
export function Header({ homeTo = '/', nav }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-primary-dark">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-baseline justify-between gap-x-6 gap-y-3 px-4 py-4">
        <div className="flex items-baseline gap-3">
          <Link to={homeTo} aria-label="SKS Lotse – Startseite">
            <Logo inverted />
          </Link>
        </div>
        {nav === undefined ? (
          <nav className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <MarketingLinks />
            <Link to="/login" className={HEADER_CTA}>
              Anmelden
            </Link>
          </nav>
        ) : (
          nav
        )}
      </div>
    </header>
  )
}
