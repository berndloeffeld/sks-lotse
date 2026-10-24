import { PageLayout } from '../components/PageLayout'
import { PrivacyContent } from '../../shared/legal/PrivacyContent'

export function PrivacyPage() {
  return (
    <PageLayout title="Datenschutzerklärung" nav="public">
      <PrivacyContent />
    </PageLayout>
  )
}
