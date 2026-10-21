import type { DerivationBlock } from '../api/types'
import { AnswerBox } from './AnswerBox'
import { RichText } from './RichText'

// A derivation: the working that leads to an answer. The Kartenaufgaben's is the WSV's own (ADR-0053),
// shown inside the official solution; a catalog question's is SKS Lotse's (ADR-0065), shown apart from
// the official answer and marked as not official.

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

/** A catalog question's derivation, below its official answer; nothing when the question has none. */
export function CatalogDerivation({ blocks, headingLevel }: { blocks: DerivationBlock[]; headingLevel?: 2 | 3 }) {
  if (blocks.length === 0) return null
  return (
    <AnswerBox variant="note" title="Herleitung · nicht amtlich" headingLevel={headingLevel}>
      <p className="text-xs text-ink-soft">
        Von SKS Lotse erstellt, nicht Teil des amtlichen Fragenkatalogs. Maßgeblich ist die amtliche Antwort.
      </p>
      <details>
        <summary className="cursor-pointer text-primary">Herleitung anzeigen</summary>
        <div className="pt-2">
          <DerivationText blocks={blocks} />
        </div>
      </details>
    </AnswerBox>
  )
}
