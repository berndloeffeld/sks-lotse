import type { ChartAttemptTask, ChartImage } from '../api/types'
import { pointsLabel } from '../chartPoints'
import { RichText } from './RichText'

// The pieces of a Kartenaufgabe shown in more than one place (the run, the Verlauf, the result).

/** Rendered at twice the PDF's size (scripts/extract_chart_exercises.py): sharp when scaled up to the column. */
export function ChartImages({ images, alt }: { images: ChartImage[]; alt: string }) {
  return (
    <div className="flex flex-col gap-2">
      {images.map((image, i) => (
        // A click opens the full resolution, for reading the small print of a table or a drawing.
        <a key={image.src} href={`/charts/${image.src}`} target="_blank" rel="noreferrer">
          <img
            src={`/charts/${image.src}`}
            width={Math.round(image.width / 2)}
            height={Math.round(image.height / 2)}
            alt={images.length > 1 ? `${alt}, Teil ${i + 1} von ${images.length}` : alt}
            // As wide as the column allows (the print is small at 1:1), but never past full resolution.
            // Cut from the white PDF page; keep it white in dark mode.
            style={{ maxWidth: image.width }}
            className="h-auto w-full rounded border border-border bg-white"
          />
        </a>
      ))}
    </div>
  )
}

/** The task as the sheet states it: scenario, then the questions with their points. */
export function ChartTaskText({ task }: { task: ChartAttemptTask }) {
  return (
    <div className="flex flex-col gap-3">
      {task.text ? (
        <p className="leading-relaxed whitespace-pre-line text-ink">
          <RichText text={task.text} />
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {task.questions.map((question) => (
          <li key={question.text} className="flex gap-3">
            <span aria-hidden="true" className="w-6 shrink-0 font-mono text-primary">
              {'•'.repeat(question.points)}
            </span>
            <span className="leading-relaxed font-semibold whitespace-pre-line text-primary">
              <RichText text={question.text} />
              <span className="sr-only"> ({pointsLabel(question.points)})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function OwnAnswer({ text }: { text: string }) {
  return (
    <section className="flex flex-col gap-1 rounded-tile border-l-4 border-ink-soft bg-surface px-3 py-2">
      <h3 className="font-mono text-xs tracking-wide text-ink-soft uppercase">Deine Antwort</h3>
      <p className="text-sm whitespace-pre-line text-ink-soft">{text.trim() || '(keine Antwort)'}</p>
    </section>
  )
}

/** The official results; the working that leads to them (tide tables, stream diamonds …) only on request. */
export function OfficialSolution({ task }: { task: ChartAttemptTask }) {
  return (
    <section className="flex flex-col gap-2 rounded-tile border-l-4 border-primary bg-surface-alt px-3 py-2">
      <h3 className="font-mono text-xs tracking-wide text-ink-soft uppercase">Amtliche Lösung</h3>
      <ChartImages images={task.solution_images} alt={`Amtliche Lösung zu Aufgabe ${task.number}`} />
      {task.derivation_images.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm text-primary">Herleitung anzeigen</summary>
          <div className="pt-2">
            <ChartImages images={task.derivation_images} alt={`Amtliche Herleitung zu Aufgabe ${task.number}`} />
          </div>
        </details>
      ) : null}
    </section>
  )
}
