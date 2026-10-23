import { FaqAnswer } from '../components/FaqAnswer'
import { ProseSection } from '../components/ProseSection'
import { SBF_FAQ } from './faq'
import { SbfPageLayout } from './SbfPageLayout'

export function SbfFaqPage() {
  return (
    <SbfPageLayout title="Häufige Fragen">
      {SBF_FAQ.map(({ id, question, answer }) => (
        <ProseSection key={id} id={id} title={question}>
          <p>
            <FaqAnswer answer={answer} linkClassName="underline hover:text-primary" />
          </p>
        </ProseSection>
      ))}
    </SbfPageLayout>
  )
}
