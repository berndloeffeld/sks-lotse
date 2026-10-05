import type { ChartAttemptTask, ChartDerivationBlock, ChartImage, ChartSolutionPart } from '../api/types'
import { pointsLabel } from '../chartPoints'
import { RichText } from './RichText'

// The pieces of a Kartenaufgabe shown in more than one place (the run, the Verlauf, the result).

/** The drawn Stromdreieck, cut from the PDF at twice its size: sharp when scaled up to the column. */
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

export function OwnAnswer({ text }: { text: string }) {
  return (
    <section className="flex flex-col gap-1 rounded-tile border-l-4 border-ink-soft bg-surface px-3 py-2">
      <h3 className="font-mono text-xs tracking-wide text-ink-soft uppercase">Deine Antwort</h3>
      <p className="text-sm whitespace-pre-line text-ink-soft">{text.trim() || '(keine Antwort)'}</p>
    </section>
  )
}

/** Transcribed text where **…** marks what the PDF prints bold. */
function ChartText({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/).map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold">
            <RichText text={part} />
          </strong>
        ) : (
          <RichText key={i} text={part} />
        ),
      )}
    </>
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
      <div className="text-sm text-ink">
        <SolutionResults part={parts[0]} />
      </div>
    )
  }
  return (
    <ul className="flex flex-col gap-2 text-sm text-ink">
      {parts.map((part, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden="true">•</span>
          <SolutionResults part={part} />
        </li>
      ))}
    </ul>
  )
}

function DerivationBlock({ block }: { block: ChartDerivationBlock }) {
  if (!block.table) {
    return (
      <p>
        <ChartText text={block.text ?? ''} />
      </p>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse">
        <tbody>
          {block.table.map((row, r) => (
            <tr key={r}>
              {row.cells.map((cell, c) => (
                <td
                  key={c}
                  className={[
                    'py-0.5 pr-3',
                    c === 0 ? '' : 'text-right whitespace-nowrap',
                    row.sum && c < (row.sum_until ?? row.cells.length) ? 'border-t border-ink' : '',
                  ].join(' ')}
                >
                  <ChartText text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DerivationText({ blocks }: { blocks: ChartDerivationBlock[] }) {
  return (
    <div className="flex flex-col gap-2 text-sm text-ink">
      {blocks.map((block, i) => (
        <DerivationBlock key={i} block={block} />
      ))}
    </div>
  )
}

/** The official results; the working that leads to them (tide tables, course conversions …) only on request. */
export function OfficialSolution({ task }: { task: ChartAttemptTask }) {
  return (
    <section className="flex flex-col gap-2 rounded-tile border-l-4 border-primary bg-surface-alt px-3 py-2">
      <h3 className="font-mono text-xs tracking-wide text-ink-soft uppercase">Amtliche Lösung</h3>
      <SolutionText parts={task.solution} />
      {task.derivation.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm text-primary">Herleitung anzeigen</summary>
          <div className="pt-2">
            <DerivationText blocks={task.derivation} />
          </div>
        </details>
      ) : null}
    </section>
  )
}
