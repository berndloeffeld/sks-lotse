import type { ReactNode } from 'react'

import type { QuestionImage } from '../api/types'
import { parseAnswer } from '../answerTable'
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

// A Kartenaufgabe's answer, whose table (ADR-0062) shows as a table, as it was written: grid lines,
// the first column the labels. Only there: an answer elsewhere is plain text, even if a line looks like a row.
export function ChartOwnAnswer({ text }: { text: string | null | undefined }) {
  const blocks = parseAnswer(text ?? '')
  if (blocks.length === 0) return <OwnAnswer text={text} />
  return (
    <AnswerBox variant="own" title="Deine Antwort">
      {blocks.map((block, i) =>
        block.kind === 'text' ? (
          <p key={i} className="whitespace-pre-line text-ink-soft">
            {block.text}
          </p>
        ) : (
          <div key={i} className="overflow-x-auto">
            <table className="border-collapse text-ink">
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) =>
                      c === 0 ? (
                        <th
                          key={c}
                          scope="row"
                          className="border border-border bg-surface-alt px-2 py-1 text-left font-semibold"
                        >
                          {cell}
                        </th>
                      ) : (
                        <td key={c} className="border border-border px-2 py-1">
                          {cell}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
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
