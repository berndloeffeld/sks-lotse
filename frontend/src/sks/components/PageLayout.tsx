import { useLocation } from 'react-router-dom'

import { useAuthStore } from '../../shared/store/authStore'
import { Header } from './Header'
import { LoginLink } from '../../shared/components/LoginLink'
import { MainNav } from './MainNav'
import { MobileTabBar } from './MobileTabBar'
import { PageShell, type PageShellProps } from '../../shared/components/PageShell'
import { buttonClass } from '../../shared/components/buttonStyles'

interface PageLayoutProps extends PageShellProps {
  // Logged-in pages get the main nav (and the tab bar on phones) and a brand link to /learn;
  // `public` pages the default "Anmelden" link; `none` no nav at all.
  nav?: 'account' | 'public' | 'none'
  // A running practice, exam or chart session: no phone tab bar, so the task
  // (and the keyboard) get the screen.
  immersive?: boolean
}

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
        <button type="button" onClick={dismiss} className={`${buttonClass('tertiary')} ml-auto`}>
          Schließen
        </button>
      </div>
    </div>
  )
}

// SKS Lotse's page: the shell (PageShell) with the session — the account nav once logged in, and
// the notice when the session ran out.
export function PageLayout({ nav = 'account', immersive = false, ...shell }: PageLayoutProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  // Public pages (Impressum, Datenschutz) show the account nav once logged in.
  const showAccountNav = nav === 'account' || (nav === 'public' && isAuthenticated)

  return (
    <PageShell
      {...shell}
      header={
        <Header
          homeTo={showAccountNav ? '/learn' : '/'}
          nav={showAccountNav ? <MainNav /> : nav === 'none' ? null : undefined}
        />
      }
      notice={<SessionExpiredNotice />}
      after={showAccountNav && !immersive ? <MobileTabBar /> : null}
    />
  )
}
