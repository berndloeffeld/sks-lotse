import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

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
  children: ReactNode
}

const WIDTH = { sm: 'max-w-sm', md: 'max-w-2xl' }

// The banded page shell every non-landing page shares: dark header, primary
// title band with a slanted edge, content on the light background, dark
// footer (which carries the §5 DDG Impressum link on every page).
export function PageLayout({ title, subtitle, backTo, nav = 'account', width = 'md', children }: PageLayoutProps) {
  const column = `mx-auto w-full px-4 ${WIDTH[width]}`

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Header
        homeTo={nav === 'account' ? '/start' : '/'}
        nav={nav === 'account' ? <AccountNav /> : nav === 'none' ? null : undefined}
      />
      <main className="flex-1">
        <HeroBand>
          <div className={column}>
            {backTo ? (
              <Link
                to={backTo}
                className="font-mono text-xs tracking-wide text-surface-alt uppercase hover:text-surface"
              >
                ← Zurück
              </Link>
            ) : null}
            <h1 className="mt-2 font-serif text-3xl break-words">{title}</h1>
            {subtitle ? <div className="mt-2 text-sm text-surface-alt">{subtitle}</div> : null}
          </div>
        </HeroBand>
        <div className={`${column} flex flex-col gap-8 pt-4 pb-12`}>{children}</div>
      </main>
      <LegalFooter />
    </div>
  )
}
