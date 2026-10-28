import type { ReactNode } from 'react'

import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { siteIdentity } from '../siteConfig'
import { HeroBand } from './HeroBand'
import { LegalFooter } from './LegalFooter'

export interface PageShellProps {
  title: string
  subtitle?: ReactNode
  // `lg` fits a second column beside the content (the Kartenaufgaben's tools).
  width?: 'sm' | 'md' | 'lg'
  // Slimmer title band for pages where the content should start sooner.
  compact?: boolean
  // Slimmest title band, without the subtitle: a running session, where the task needs the screen.
  slim?: boolean
  // Full-width children (e.g. <Band>s) instead of one content column.
  bands?: boolean
  children: ReactNode
}

interface ShellSlots {
  // The top bar (HeaderBar, with the site's links).
  header: ReactNode
  // Between the header and the title band (PageLayout's "session expired").
  notice?: ReactNode
  // After the footer (PageLayout's phone tab bar).
  after?: ReactNode
}

const WIDTH = { sm: 'max-w-sm', md: 'max-w-2xl', lg: 'max-w-6xl', bands: 'max-w-4xl' }

// The banded page shell every non-landing page shares: dark header, primary
// title band with a slanted edge, content on the light background, dark
// footer (which carries the §5 DDG Impressum link on every page). Without
// the session: SKS Lotse's pages get it through PageLayout, SBF Lotse's go
// without one (ADR-0067).
export function PageShell({
  title,
  subtitle,
  width = 'md',
  compact = false,
  slim = false,
  bands = false,
  header,
  notice,
  after,
  children,
}: PageShellProps & ShellSlots) {
  useDocumentTitle(`${title} – ${siteIdentity().name}`)
  const column = `mx-auto w-full px-4 ${WIDTH[bands ? 'bands' : width]}`

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      {header}
      {notice}
      <main className="flex-1">
        <HeroBand className={`${slim ? 'pt-3 pb-7' : compact ? 'pt-6 pb-12' : 'pt-12 pb-24'} text-center`}>
          <div className={column}>
            <h1
              className={`font-serif tracking-wide break-words uppercase ${
                slim ? 'text-xl' : compact ? 'mt-2 text-2xl sm:text-3xl' : 'mt-4 text-3xl sm:text-4xl'
              }`}
            >
              {title}
            </h1>
            {subtitle && !slim ? (
              <div className={`text-sm text-surface-alt ${compact ? 'mt-2' : 'mt-4'}`}>{subtitle}</div>
            ) : null}
          </div>
        </HeroBand>
        {bands ? children : <div className={`${column} flex flex-col gap-8 pt-4 pb-12`}>{children}</div>}
      </main>
      <LegalFooter />
      {after}
    </div>
  )
}
