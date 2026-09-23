import { FAQ } from '../faq'
import { PageLayout } from '../components/PageLayout'

export function FaqPage() {
  return (
    <PageLayout title="Häufige Fragen" nav="public">
      {FAQ.map(({ id, question, answer }) => (
        <section key={id} id={id} className="flex flex-col gap-2 scroll-mt-4">
          <h2 className="font-serif text-xl text-primary">{question}</h2>
          <p className="text-ink-soft">{answer}</p>
        </section>
      ))}
    </PageLayout>
  )
}
