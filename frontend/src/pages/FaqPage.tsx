import { FAQ } from '../faq'
import { PageLayout } from '../components/PageLayout'
import { ProseSection } from '../components/ProseSection'

export function FaqPage() {
  return (
    <PageLayout title="Häufige Fragen" nav="public">
      {FAQ.map(({ id, question, answer }) => (
        <ProseSection key={id} id={id} title={question}>
          <p>{answer}</p>
        </ProseSection>
      ))}
    </PageLayout>
  )
}
