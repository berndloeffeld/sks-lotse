import { FaqAnswer } from '../shared/components/FaqAnswer'
import { ProseSection } from '../shared/components/ProseSection'
import { sbfNavigationOpen } from '../shared/siteConfig'
import { sbfFaq } from './faq'
import { SbfPageLayout } from './SbfPageLayout'

export function SbfFaqPage() {
  return (
    <SbfPageLayout title="Häufige Fragen">
      {sbfFaq(sbfNavigationOpen()).map(({ id, question, answer }) => (
        <ProseSection key={id} id={id} title={question}>
          <p>
            <FaqAnswer answer={answer} linkClassName="underline hover:text-primary" />
          </p>
        </ProseSection>
      ))}
    </SbfPageLayout>
  )
}
