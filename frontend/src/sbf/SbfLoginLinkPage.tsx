import { LoginLinkPanel } from '../shared/components/LoginLinkPanel'
import { SbfPageLayout } from './SbfPageLayout'

// Where the login link in the code email lands (ADR-0064), on sbf-lotse.de for a code requested
// here (ADR-0070).
export function SbfLoginLinkPage() {
  return (
    <SbfPageLayout title="Anmelden" width="sm">
      <LoginLinkPanel />
    </SbfPageLayout>
  )
}
