import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { AccountNav } from './AccountNav'
import { Header } from './Header'
import { HeroBand } from './HeroBand'
import { LegalFooter } from './LegalFooter'

interface PageLayoutProps {
  title: string
  subtitle?: ReactNode
  // Renders a "← Zurück" link above the title.
  backTo?: string
  // Logged-in pages get the account nav and a brand link to /start;
  // `public` pages the default "Anmelden" link; `none` no nav at all.
  nav?: 'account' | 'public' | 'none'
  width?: 'sm' | 'md'
  // Full-width children (e.g. <Band>s) instead of one content column.
  bands?: boolean
  children: ReactNode
}

const WIDTH = { sm: 'max-w-sm', md: 'max-w-2xl', bands: 'max-w-4xl' }

// The banded page shell every non-landing page shares: dark header, primary
// title band with a slanted edge, content on the light background, dark
// footer (which carries the §5 DDG Impressum link on every page).
export function PageLayout({
  title,
  subtitle,
  backTo,
  nav = 'account',
  width = 'md',
  bands = false,
  children,
}: PageLayoutProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  // Public pages (Impressum, Datenschutz) show the account nav once logged in.
  const showAccountNav = nav === 'account' || (nav === 'public' && isAuthenticated)
  const column = `mx-auto w-full px-4 ${WIDTH[bands ? 'bands' : width]}`

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Header
        homeTo={showAccountNav ? '/start' : '/'}
        nav={showAccountNav ? <AccountNav /> : nav === 'none' ? null : undefined}
      />
      <main className="flex-1">
        <HeroBand className="pt-12 pb-24 text-center">
          <div className={column}>
            {backTo ? (
              <Link
                to={backTo}
                className="block text-left font-mono text-xs tracking-wide text-surface-alt uppercase hover:text-surface"
              >
                ← Zurück
              </Link>
            ) : null}
            <h1 className="mt-4 font-serif text-3xl tracking-wide break-words uppercase sm:text-4xl">{title}</h1>
            {subtitle ? <div className="mt-4 text-sm text-surface-alt">{subtitle}</div> : null}
          </div>
        </HeroBand>
        {bands ? children : <div className={`${column} flex flex-col gap-8 pt-4 pb-12`}>{children}</div>}
      </main>
      <LegalFooter />
    </div>
  )
}
