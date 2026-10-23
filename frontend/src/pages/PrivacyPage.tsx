import { PageLayout } from '../components/PageLayout'
import { PrivacyContent } from '../legal/PrivacyContent'

export function PrivacyPage() {
  return (
    <PageLayout title="Datenschutzerklärung" nav="public">
      <PrivacyContent />
    </PageLayout>
  )
}
