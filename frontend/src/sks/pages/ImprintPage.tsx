import { PageLayout } from '../components/PageLayout'
import { ImprintContent } from '../../shared/legal/ImprintContent'

export function ImprintPage() {
  return (
    <PageLayout title="Impressum" nav="public">
      <ImprintContent />
    </PageLayout>
  )
}
