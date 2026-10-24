import type { QuestionImage } from '../api/types'
import { QuestionImages } from './QuestionImages'
import { RichText } from './RichText'

/**
 * The body of an official answer: its text, its images, and, for the few answers that are only a
 * sketch in the catalog PDF and whose sketch is missing, a sentence saying so. The heading and the
 * box around it are OfficialAnswerBox's (AnswerBox.tsx).
 */
export function OfficialAnswer({ text, images }: { text: string | null | undefined; images: QuestionImage[] }) {
  return (
    <>
      {text ? (
        <p className="whitespace-pre-line text-ink">
          <RichText text={text} />
        </p>
      ) : images.length === 0 ? (
        <p className="text-ink-soft italic">
          Die amtliche Antwort zu dieser Frage besteht nur aus einer Skizze, die SKS Lotse nicht anzeigen kann.
        </p>
      ) : null}
      <QuestionImages images={images} part="answer" />
    </>
  )
}
