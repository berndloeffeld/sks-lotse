import type { Question } from '../api/types'
import { OfficialAnswer } from './OfficialAnswer'
import { QuestionImages } from './QuestionImages'
import { RichText } from './RichText'

// Every question of a topic with its official answer, each folded shut, below the practice run
// (ADR-0054): to look one up, and so the page's HTML carries the whole topic for search engines,
// while the answer stays hidden until it is opened. The wording is the official catalog's, unchanged.
export function TopicQuestionList({ questions }: { questions: Question[] }) {
  return (
    <section aria-labelledby="topic-questions" className="flex flex-col gap-3 border-t border-border pt-8">
      <h2 id="topic-questions" className="font-serif text-2xl text-primary">
        Alle Fragen dieses Themas
      </h2>
      <ul className="flex flex-col">
        {questions.map((question) => (
          <li key={question.id} id={`frage-${question.number}`} className="border-b border-border last:border-b-0">
            <details className="group py-3">
              <summary className="flex cursor-pointer gap-3 text-ink marker:content-none">
                <span className="shrink-0 font-mono text-xs leading-6 text-ink-soft">Nr. {question.number}</span>
                <span className="flex-1 leading-6 whitespace-pre-line">
                  <RichText text={question.question_text} />
                </span>
                <span aria-hidden="true" className="text-ink-soft transition group-open:rotate-90">
                  ›
                </span>
              </summary>
              <div className="mt-3 flex flex-col gap-2 pl-12">
                <QuestionImages images={question.question_images} part="question" />
                <div className="rounded-tile border-l-4 border-primary bg-surface-alt px-3 py-2">
                  <h3 className="font-mono text-xs tracking-wide text-ink-soft uppercase">Amtliche Antwort</h3>
                  <OfficialAnswer text={question.answer_text} images={question.answer_images} textClassName="text-sm" />
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  )
}
