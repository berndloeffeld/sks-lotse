import { LoginLinkPanel } from '../../shared/components/LoginLinkPanel'
import { PageLayout } from '../components/PageLayout'

// Where the login link in the code email lands (ADR-0064).
export function LoginLinkPage() {
  return (
    <PageLayout title="Anmelden" nav="none" width="sm">
      <LoginLinkPanel />
    </PageLayout>
  )
}
