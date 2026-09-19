import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Logo } from './Logo'

// Shared style for text links/buttons sitting on the header's dark band.
export const HEADER_LINK =
  'border-b-2 border-transparent pb-1 font-mono text-xs tracking-wide text-surface-alt uppercase hover:border-surface hover:text-surface'

interface HeaderProps {
  // Where the brand links to: `/` when logged out, `/start` when logged in.
  homeTo?: string
  // Right-hand side; defaults to an "Anmelden" link (logged-out pages).
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
          <span
            className="border border-surface-alt px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-surface-alt uppercase"
            title="Beta-Version: SKS Lotse wird gerade aufgebaut."
          >
            Beta
          </span>
        </div>
        {nav === undefined ? (
          <Link to="/login" className={HEADER_LINK}>
            Anmelden
          </Link>
        ) : (
          nav
        )}
      </div>
    </header>
  )
}
