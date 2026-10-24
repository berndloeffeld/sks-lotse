import { FAQ } from '../faq'
import { FaqAnswer } from '../../shared/components/FaqAnswer'
import { PageLayout } from '../components/PageLayout'
import { ProseSection } from '../../shared/components/ProseSection'

export function FaqPage() {
  return (
    <PageLayout title="Häufige Fragen zur SKS-Theorieprüfung" nav="public">
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
