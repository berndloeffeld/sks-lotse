// The FAQ answers' link syntax, for both sites' FAQs (src/sks/faq.ts, src/sbf/faq.ts): an answer
// links to another page with `[text](/path)`; FaqAnswer renders that as a Link.

export type FaqAnswerPart = { text: string; to?: string }

const LINK = /\[([^\]]+)\]\((\/[^)\s]*)\)/g

// An answer split into plain text and in-app links (`[text](/path)` — only site-relative paths).
export function faqAnswerParts(answer: string): FaqAnswerPart[] {
  const parts: FaqAnswerPart[] = []
  let last = 0
  for (const match of answer.matchAll(LINK)) {
    if (match.index > last) parts.push({ text: answer.slice(last, match.index) })
    parts.push({ text: match[1], to: match[2] })
    last = match.index + match[0].length
  }
  if (last < answer.length) parts.push({ text: answer.slice(last) })
  return parts
}
