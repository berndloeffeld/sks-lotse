import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'

import type { ChartAnswerDraft } from '../answerTable'

const EMPTY_TABLE = Array.from({ length: 3 }, () => ['', '', ''])

interface ChartAnswerEditorProps {
  draft: ChartAnswerDraft
  onChange: (draft: ChartAnswerDraft) => void
  // The first text field: the form's label points at it, and it takes the focus first.
  fieldId: string
  fieldRef: RefObject<HTMLTextAreaElement | null>
  describedBy: string
  // The answer's Enter shortcut; in a cell, where it doesn't take the key, Enter moves to the next one.
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void
}

const tool =
  'rounded-tile px-2 py-1 font-mono text-xs tracking-wide text-primary uppercase hover:bg-surface-alt disabled:opacity-40 disabled:hover:bg-transparent'
// The fields grow with their text (where the browser can), so the frame has no resize handles inside.
const text = 'block w-full resize-none bg-transparent px-3 py-2 text-base text-ink outline-none field-sizing-content'

// One frame, after an editor like Confluence's but much plainer: a tool bar on top, the text, and a
// table inside the same frame, so it is plainly part of the answer. The table's first column holds
// the labels (as in the official derivation), set off as a header column.
export function ChartAnswerEditor({
  draft,
  onChange,
  fieldId,
  fieldRef,
  describedBy,
  onKeyDown,
}: ChartAnswerEditorProps) {
  const { table } = draft
  const cells = useRef(new Map<string, HTMLInputElement>())
  const focusCell = useRef<[number, number] | null>(null)
  const width = table?.[0]?.length ?? 0

  useEffect(() => {
    if (!focusCell.current) return
    const [r, c] = focusCell.current
    focusCell.current = null
    cells.current.get(`${r}-${c}`)?.focus()
  })

  function setTable(rows: string[][], focus?: [number, number]) {
    if (focus) focusCell.current = focus
    onChange({ ...draft, table: rows })
  }

  // The table goes, the text above and below it become one field again.
  function removeTable() {
    const joined = [draft.above, draft.below].filter((part) => part.trim() !== '').join('\n')
    onChange({ above: joined, table: null, below: '' })
    fieldRef.current?.focus()
  }

  function onCellKeyDown(event: KeyboardEvent<HTMLInputElement>, r: number, c: number) {
    onKeyDown(event)
    if (event.defaultPrevented || event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    cells.current.get(c + 1 < width ? `${r}-${c + 1}` : `${r + 1}-0`)?.focus()
  }

  return (
    <div className="rounded-tile border-2 border-primary bg-surface focus-within:ring-2 focus-within:ring-accent">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-1 py-1">
        {table ? (
          <>
            <button
              type="button"
              className={tool}
              onClick={() => setTable([...table, Array<string>(width).fill('')], [table.length, 0])}
            >
              + Zeile
            </button>
            <button
              type="button"
              className={tool}
              onClick={() =>
                setTable(
                  table.map((row) => [...row, '']),
                  [0, width],
                )
              }
            >
              + Spalte
            </button>
            <button
              type="button"
              className={tool}
              disabled={table.length < 2}
              onClick={() => setTable(table.slice(0, -1))}
            >
              − Zeile
            </button>
            <button
              type="button"
              className={tool}
              disabled={width < 3}
              onClick={() => setTable(table.map((row) => row.slice(0, -1)))}
            >
              − Spalte
            </button>
            <button type="button" className={`${tool} ml-auto`} onClick={removeTable}>
              Tabelle entfernen
            </button>
          </>
        ) : (
          <button
            type="button"
            className={`${tool} inline-flex items-center gap-1.5`}
            onClick={() => setTable(EMPTY_TABLE, [0, 0])}
          >
            <TableIcon />
            Tabelle einfügen
          </button>
        )}
      </div>
      <textarea
        id={fieldId}
        aria-describedby={describedBy}
        ref={fieldRef}
        value={draft.above}
        onChange={(event) => onChange({ ...draft, above: event.target.value })}
        onKeyDown={onKeyDown}
        rows={table ? 2 : 4}
        className={`${text} ${table ? 'min-h-12' : 'min-h-28'}`}
      />
      {table ? (
        <>
          <div className="overflow-x-auto px-3 py-1">
            <table aria-label="Tabelle" className="border-collapse">
              <tbody>
                {table.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => {
                      const Cell = c === 0 ? 'th' : 'td'
                      return (
                        <Cell
                          key={c}
                          scope={c === 0 ? 'row' : undefined}
                          className={`border border-border p-0 ${c === 0 ? 'bg-surface-alt' : ''}`}
                        >
                          <input
                            ref={(el) => {
                              if (el) cells.current.set(`${r}-${c}`, el)
                              else cells.current.delete(`${r}-${c}`)
                            }}
                            aria-label={`Zeile ${r + 1}, Spalte ${c + 1}`}
                            value={cell}
                            onChange={(event) =>
                              setTable(
                                table.map((cells, i) =>
                                  i === r ? cells.map((v, j) => (j === c ? event.target.value : v)) : cells,
                                ),
                              )
                            }
                            onKeyDown={(event) => onCellKeyDown(event, r, c)}
                            enterKeyHint="next"
                            className={`${c === 0 ? 'w-32 font-semibold sm:w-40' : 'w-24 sm:w-28'} bg-transparent px-2 py-1.5 text-left text-base text-ink outline-none focus:outline-2 focus:-outline-offset-2 focus:outline-primary`}
                          />
                        </Cell>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <textarea
            aria-label="Text unter der Tabelle"
            value={draft.below}
            onChange={(event) => onChange({ ...draft, below: event.target.value })}
            onKeyDown={onKeyDown}
            rows={2}
            className={`${text} min-h-12`}
          />
        </>
      ) : null}
    </div>
  )
}

function TableIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1" />
      <path d="M1.75 6.25h12.5M1.75 9.75h12.5M6 6.25v7" />
    </svg>
  )
}
