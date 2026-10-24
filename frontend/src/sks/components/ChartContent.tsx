import { useState } from 'react'

import type { ChartAttemptTask, ChartImage, ChartSolutionPart } from '../api/types'
import { pointsLabel } from '../../shared/chartPoints'
import { AnswerBox } from './AnswerBox'
import { DerivationDetails } from './Derivation'
import { ImageLightbox } from '../../shared/components/ImageLightbox'
import { RichText } from './RichText'

// The pieces of a Kartenaufgabe shown in more than one place (the run, the Verlauf, the result).

/** Pieces of the PDF (a drawn Stromdreieck, a task), cut at twice their size: sharp when scaled up to the column. */
export function ChartImages({ images, alt }: { images: ChartImage[]; alt: string }) {
  const [shown, setShown] = useState<number | null>(null)
  const label = (i: number) => (images.length > 1 ? `${alt}, Teil ${i + 1} von ${images.length}` : alt)
  const big = shown === null ? null : images[shown]
  return (
    <div className="flex flex-col gap-2">
      {images.map((image, i) => (
        // A click shows it at full resolution, for reading the small print of a table or a drawing.
        <button key={image.src} type="button" aria-label={`${label(i)} vergrößern`} onClick={() => setShown(i)}>
          <img
            src={`/charts/${image.src}`}
            width={Math.round(image.width / 2)}
            height={Math.round(image.height / 2)}
            alt={label(i)}
            loading="lazy"
            decoding="async"
            // As wide as the column allows (the print is small at 1:1), but never past full resolution.
            // Cut from the white PDF page: on `surface` (white), transparent parts stay white.
            style={{ maxWidth: image.width }}
            className="h-auto w-full cursor-zoom-in rounded-tile border border-border bg-surface"
          />
        </button>
      ))}
      {big && shown !== null ? (
        <ImageLightbox
          src={`/charts/${big.src}`}
          width={big.width}
          height={big.height}
          alt={label(shown)}
          onClose={() => setShown(null)}
        />
      ) : null}
    </div>
  )
}

/** The task as the sheet states it: scenario, then the questions — set alike, the questions are evident. */
export function ChartTaskText({ task }: { task: ChartAttemptTask }) {
  return (
    <div className="flex flex-col gap-3">
      {task.text ? (
        <p className="leading-relaxed whitespace-pre-line text-ink">
          <RichText text={task.text} />
        </p>
      ) : null}
      {task.questions.map((question) => (
        <p key={question.text} className="leading-relaxed whitespace-pre-line text-ink">
          <RichText text={question.text} />
          <span className="sr-only"> ({pointsLabel(question.points)})</span>
        </p>
      ))}
    </div>
  )
}

function SolutionResults({ part }: { part: ChartSolutionPart }) {
  return (
    <div className="flex flex-col gap-1">
      {part.results.map((result) => (
        <p key={result.text}>
          <RichText text={result.text} />
          {result.tolerance ? <span className="text-ink-soft"> [{result.tolerance}]</span> : null}
        </p>
      ))}
      {part.image ? <ChartImages images={[part.image]} alt="Amtliche Zeichnung" /> : null}
    </div>
  )
}

/** One bullet per point bullet of the PDF, with its results and their tolerance; a lone part needs no bullet. */
function SolutionText({ parts }: { parts: ChartSolutionPart[] }) {
  if (parts.length === 1) {
    return (
      <div className="text-ink">
        <SolutionResults part={parts[0]} />
      </div>
    )
  }
  return (
    <ul className="flex flex-col gap-2 text-ink">
      {parts.map((part, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden="true">•</span>
          <SolutionResults part={part} />
        </li>
      ))}
    </ul>
  )
}

/** The official results; the working that leads to them (tide tables, course conversions …) only on request. */
export function OfficialSolution({ task }: { task: ChartAttemptTask }) {
  return (
    <AnswerBox variant="official" title="Amtliche Lösung">
      <SolutionText parts={task.solution} />
      <DerivationDetails blocks={task.derivation} />
    </AnswerBox>
  )
}
