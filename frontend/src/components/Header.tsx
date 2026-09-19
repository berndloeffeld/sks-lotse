import { Link } from 'react-router-dom'

import { Logo } from './Logo'

// Full-width primary-dark bar — the top band of the landing page's
// banded layout (see LandingPage).
export function Header() {
  return (
    <header className="bg-primary-dark">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-4">
        <Link to="/" aria-label="SKS Lotse – Startseite">
          <Logo inverted />
        </Link>
        <Link
          to="/login"
          className="border-b-2 border-transparent pb-1 font-mono text-xs tracking-wide text-surface-alt uppercase hover:border-surface hover:text-surface"
        >
          Anmelden
        </Link>
      </div>
    </header>
  )
}
