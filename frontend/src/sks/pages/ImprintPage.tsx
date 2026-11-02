import { PageLayout } from '../components/PageLayout'
import { ImprintContent } from '../legal/ImprintContent'

export function ImprintPage() {
  return (
    <PageLayout title="Impressum" nav="public">
      <ImprintContent />
    </PageLayout>
  )
}
