import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuthStore } from '../store/authStore'
import { Header } from './Header'
import { HeroBand } from './HeroBand'
import { LegalFooter } from './LegalFooter'
import { LoginLink } from './LoginLink'
import { MainNav } from './MainNav'
import { MobileTabBar } from './MobileTabBar'

interface PageLayoutProps {
  title: string
  subtitle?: ReactNode
  // Logged-in pages get the main nav (and the tab bar on phones) and a brand link to /learn;
  // `public` pages the default "Anmelden" link; `none` no nav at all.
  nav?: 'account' | 'public' | 'none'
  // `lg` fits a second column beside the content (the Kartenaufgaben's tools).
  width?: 'sm' | 'md' | 'lg'
  // Slimmer title band for pages where the content should start sooner.
  compact?: boolean
  // Full-width children (e.g. <Band>s) instead of one content column.
  bands?: boolean
  // A running practice, exam or chart session: no phone tab bar, so the task
  // (and the keyboard) get the screen.
  immersive?: boolean
  children: ReactNode
}

const WIDTH = { sm: 'max-w-sm', md: 'max-w-2xl', lg: 'max-w-6xl', bands: 'max-w-4xl' }

// Said once a request found the learner's session gone, so the page doesn't just turn into the
// guest's without a word (authStore.sessionExpired) — on /login, where ProtectedRoute sends them,
// as on the public pages that stay. Until the next login or "Schließen".
function SessionExpiredNotice() {
  const sessionExpired = useAuthStore((state) => state.sessionExpired)
  const dismiss = useAuthStore((state) => state.dismissSessionExpired)
  const { pathname } = useLocation()
  if (!sessionExpired) return null
  return (
    <div role="status" className="border-b border-border bg-surface-alt">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-baseline gap-x-4 gap-y-2 px-4 py-3 text-sm text-ink">
        <p>Deine Sitzung ist abgelaufen.</p>
        {pathname === '/login' ? null : <LoginLink className="text-primary underline">Anmelden</LoginLink>}
        <button type="button" onClick={dismiss} className="ml-auto text-ink-soft underline">
          Schließen
        </button>
      </div>
    </div>
  )
}

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
  immersive = false,
  children,
}: PageLayoutProps) {
  useDocumentTitle(`${title} – SKS Lotse`)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  // Public pages (Impressum, Datenschutz) show the account nav once logged in.
  const showAccountNav = nav === 'account' || (nav === 'public' && isAuthenticated)
  const column = `mx-auto w-full px-4 ${WIDTH[bands ? 'bands' : width]}`

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <Header
        homeTo={showAccountNav ? '/learn' : '/'}
        nav={showAccountNav ? <MainNav /> : nav === 'none' ? null : undefined}
      />
      <SessionExpiredNotice />
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
      {showAccountNav && !immersive ? <MobileTabBar /> : null}
    </div>
  )
}
