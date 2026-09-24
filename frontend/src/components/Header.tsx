import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { HEADER_CTA } from './headerLink'
import { Logo } from './Logo'
import { MarketingLinks } from './MarketingLinks'

interface HeaderProps {
  // Where the brand links to: `/` when logged out, `/start` when logged in.
  homeTo?: string
  // Right-hand side; defaults to the marketing links plus "Anmelden" (logged-out pages).
  // Pass `null` for none (the login page itself).
  nav?: ReactNode
}

// Full-width primary-dark bar — the top band of every page's banded layout.
export function Header({ homeTo = '/', nav }: HeaderProps) {
  return (
    <header className="bg-primary-dark">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <Link to={homeTo} aria-label="SKS Lotse – Startseite">
            <Logo inverted />
          </Link>
        </div>
        {nav === undefined ? (
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
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
