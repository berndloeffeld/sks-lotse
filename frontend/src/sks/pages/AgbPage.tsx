import { AgbContent } from '../legal/AgbContent'
import { PageLayout } from '../components/PageLayout'

export function AgbPage() {
  return (
    <PageLayout title="AGB" nav="public">
      <AgbContent />
    </PageLayout>
  )
}
