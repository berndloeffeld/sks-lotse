import { HeaderBar } from '../shared/components/HeaderBar'
import { PageShell, type PageShellProps } from '../shared/components/PageShell'
import { SbfHeaderNav } from './SbfHeaderNav'

// The SBF site's page (ADR-0067): the shared shell with the SBF links, and no session.
export function SbfPageLayout(props: PageShellProps) {
  return <PageShell {...props} header={<HeaderBar homeTo="/" nav={<SbfHeaderNav />} />} />
}
