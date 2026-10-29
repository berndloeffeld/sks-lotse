import { useAuthStore } from '../../shared/store/authStore'
import { Header } from './Header'
import { MainNav } from './MainNav'
import { MobileTabBar } from './MobileTabBar'
import { PageShell, type PageShellProps } from '../../shared/components/PageShell'
import { SessionExpiredNotice } from '../../shared/components/SessionExpiredNotice'

interface PageLayoutProps extends PageShellProps {
  // Logged-in pages get the main nav (and the tab bar on phones) and a brand link to /learn;
  // `public` pages the default "Anmelden" link; `none` no nav at all.
  nav?: 'account' | 'public' | 'none'
  // A running practice, exam or chart session: no phone tab bar, so the task
  // (and the keyboard) get the screen.
  immersive?: boolean
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
      slim={immersive || shell.slim}
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
