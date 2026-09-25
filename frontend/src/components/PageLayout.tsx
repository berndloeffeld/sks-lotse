import type { ReactNode } from 'react'

import { useAuthStore } from '../store/authStore'
import { AccountNav } from './AccountNav'
import { Header } from './Header'
import { HeroBand } from './HeroBand'
import { LegalFooter } from './LegalFooter'

interface PageLayoutProps {
  title: string
  subtitle?: ReactNode
  // Logged-in pages get the account nav and a brand link to /learn;
  // `public` pages the default "Anmelden" link; `none` no nav at all.
  nav?: 'account' | 'public' | 'none'
  width?: 'sm' | 'md'
  // Slimmer title band for pages where the content should start sooner.
  compact?: boolean
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
  nav = 'account',
  width = 'md',
  compact = false,
  bands = false,
  children,
}: PageLayoutProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  // Public pages (Impressum, Datenschutz) show the account nav once logged in.
  const showAccountNav = nav === 'account' || (nav === 'public' && isAuthenticated)
  const column = `mx-auto w-full px-4 ${WIDTH[bands ? 'bands' : width]}`

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <Header
        homeTo={showAccountNav ? '/learn' : '/'}
        nav={showAccountNav ? <AccountNav /> : nav === 'none' ? null : undefined}
      />
      <main className="flex-1">
        <HeroBand className={`${compact ? 'pt-6 pb-12' : 'pt-12 pb-24'} text-center`}>
          <div className={column}>
            <h1
              className={`font-serif tracking-wide break-words uppercase ${
                compact ? 'mt-2 text-2xl sm:text-3xl' : 'mt-4 text-3xl sm:text-4xl'
              }`}
            >
              {title}
            </h1>
            {subtitle ? (
              <div className={`text-sm text-surface-alt ${compact ? 'mt-2' : 'mt-4'}`}>{subtitle}</div>
            ) : null}
          </div>
        </HeroBand>
        {bands ? children : <div className={`${column} flex flex-col gap-8 pt-4 pb-12`}>{children}</div>}
      </main>
      <LegalFooter />
    </div>
  )
}
