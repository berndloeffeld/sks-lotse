import type { DerivationBlock } from '../api/types'
import { RichText } from './RichText'

// A derivation: the working that leads to an answer. The Kartenaufgaben's is the WSV's own (ADR-0053),
// a catalog question's is SKS Lotse's (ADR-0065), marked as not official. Both fold out at the foot of
// the official answer or solution. A sketch is a static file of this site, served from /derivations/.

/** Text where **…** marks an intermediate result (for the Kartenaufgaben: what the PDF prints bold). */
function BoldText({ text }: { text: string }) {
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

function Block({ block }: { block: DerivationBlock }) {
  if (block.image) {
    return (
      <img
        src={`/derivations/${block.image.src}`}
        width={block.image.width}
        height={block.image.height}
        alt={block.image.alt}
        // Drawn on white, like the catalog's images: it keeps its white background in dark mode too.
        className="h-auto max-w-full rounded-tile border border-border bg-white"
      />
    )
  }
  if (!block.table) {
    return (
      <p>
        <BoldText text={block.text ?? ''} />
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
                  <BoldText text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DerivationText({ blocks }: { blocks: DerivationBlock[] }) {
  return (
    <div className="flex flex-col gap-2 text-sm text-ink">
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  )
}

/**
 * "Herleitung anzeigen" at the foot of an official answer or solution, folded shut; nothing when there
 * is none. `note` opens the unfolded part: for a catalog question, that the derivation isn't official.
 */
export function DerivationDetails({ blocks, note }: { blocks: DerivationBlock[]; note?: string }) {
  if (blocks.length === 0) return null
  return (
    <details>
      <summary className="cursor-pointer text-primary">Herleitung anzeigen</summary>
      <div className="flex flex-col gap-2 pt-2">
        {note ? <p className="text-xs text-ink-soft">{note}</p> : null}
        <DerivationText blocks={blocks} />
      </div>
    </details>
  )
}
