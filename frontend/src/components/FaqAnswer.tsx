import { Link } from 'react-router-dom'

import { faqAnswerParts } from '../faq'

// An FAQ answer with its `[text](/path)` references as real links.
export function FaqAnswer({ answer, linkClassName }: { answer: string; linkClassName: string }) {
  return (
    <>
      {faqAnswerParts(answer).map((part, index) =>
        part.to ? (
          <Link key={index} to={part.to} className={linkClassName}>
            {part.text}
          </Link>
        ) : (
          part.text
        ),
      )}
    </>
  )
}
