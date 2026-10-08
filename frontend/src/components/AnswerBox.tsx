import type { ReactNode } from 'react'

import type { QuestionImage } from '../api/types'
import { OfficialAnswer } from './OfficialAnswer'

// The comparison "deine vs. amtliche Antwort", alike wherever it is shown: practice, the topic's
// question list, the exam's grading and result, the Kartenaufgaben and the admin question search.
// The learner's answer is set back (ink-soft rule on surface), the official one stands out (primary
// rule on surface-alt).
const VARIANT = {
  own: 'border-ink-soft bg-surface',
  official: 'border-primary bg-surface-alt',
}

interface AnswerBoxProps {
  variant: keyof typeof VARIANT
  title: string
  // The level that fits the page's outline; the look stays the same.
  headingLevel?: 2 | 3
  children: ReactNode
}

export function AnswerBox({ variant, title, headingLevel = 3, children }: AnswerBoxProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <section className={`flex flex-col gap-1 rounded-tile border-l-4 px-3 py-2 ${VARIANT[variant]}`}>
      <Heading className="font-mono text-xs tracking-wide text-ink-soft uppercase">{title}</Heading>
      <div className="flex flex-col gap-2 text-sm">{children}</div>
    </section>
  )
}

export function OwnAnswer({ text, headingLevel }: { text: string | null | undefined; headingLevel?: 2 | 3 }) {
  return (
    <AnswerBox variant="own" title="Deine Antwort" headingLevel={headingLevel}>
      {text?.trim() ? (
        <p className="whitespace-pre-line text-ink-soft">{text}</p>
      ) : (
        <p className="text-ink-soft italic">Nicht beantwortet.</p>
      )}
    </AnswerBox>
  )
}

export function OfficialAnswerBox({
  text,
  images,
  headingLevel,
}: {
  text: string | null | undefined
  images: QuestionImage[]
  headingLevel?: 2 | 3
}) {
  return (
    <AnswerBox variant="official" title="Amtliche Antwort" headingLevel={headingLevel}>
      <OfficialAnswer text={text} images={images} />
    </AnswerBox>
  )
}
