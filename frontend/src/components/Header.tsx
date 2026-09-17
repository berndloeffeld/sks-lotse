import { Link } from 'react-router-dom'

import { Logo } from './Logo'

export function Header() {
  return (
    <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-6">
      <Link to="/" aria-label="SKS Lotse – Startseite">
        <Logo />
      </Link>
      <Link to="/login" className="font-mono text-xs tracking-wide text-ink-soft uppercase hover:text-ink">
        Anmelden
      </Link>
    </header>
  )
}
