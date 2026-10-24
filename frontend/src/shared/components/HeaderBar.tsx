import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { siteIdentity } from '../siteConfig'
import { Logo } from './Logo'

interface HeaderBarProps {
  // Where the brand links to.
  homeTo: string
  // Right-hand side, if any.
  nav: ReactNode
}

// Full-width primary-dark bar — the top band of every page's banded layout. Everything in it
// sits on one text baseline: the wordmark, the links and the bordered buttons' labels.
// It sticks from `sm` on, where it is one line high: `--header-height` in index.css, which the
// sticky bars below it and the anchor jumps go by. On phones it wraps to up to three lines, so
// there it scrolls away and leaves the screen to the page. Just the bar: SKS Lotse's links are
// Header's, SBF Lotse's sbf/SbfHeaderNav's (ADR-0067), so neither site's build carries the other's.
export function HeaderBar({ homeTo, nav }: HeaderBarProps) {
  return (
    <header className="z-(--z-header) bg-primary-dark sm:sticky sm:top-0">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-baseline justify-between gap-x-6 gap-y-3 px-4 py-4">
        <div className="flex items-baseline gap-3">
          <Link to={homeTo} aria-label={`${siteIdentity().name} – Startseite`}>
            <Logo inverted />
          </Link>
        </div>
        {nav}
      </div>
    </header>
  )
}
