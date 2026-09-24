import { FAQ } from '../faq'
import { FaqAnswer } from '../components/FaqAnswer'
import { PageLayout } from '../components/PageLayout'
import { ProseSection } from '../components/ProseSection'

export function FaqPage() {
  return (
    <PageLayout title="Häufige Fragen" nav="public">
      {FAQ.map(({ id, question, answer }) => (
        <ProseSection key={id} id={id} title={question}>
          <p>
            <FaqAnswer answer={answer} linkClassName="underline hover:text-primary" />
          </p>
        </ProseSection>
      ))}
    </PageLayout>
  )
}
