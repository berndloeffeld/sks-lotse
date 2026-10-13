import { useEffect, useRef, type KeyboardEvent } from 'react'

import { buttonClass } from './buttonStyles'

interface AnswerTableEditorProps {
  rows: string[][]
  onChange: (rows: string[][]) => void
  onRemove: () => void
  // The answer's Enter shortcut; where it doesn't take the key, Enter moves on to the next cell.
  onCellKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
}

const compact = buttonClass('secondary', { size: 'compact' })

// The grid of cells in a Kartenaufgabe's answer, one per answer (ADR-0062): Tab moves through the cells, the buttons
// below add or drop the last row or column. It opens with focus in its first cell.
export function AnswerTableEditor({ rows, onChange, onRemove, onCellKeyDown }: AnswerTableEditorProps) {
  const cells = useRef(new Map<string, HTMLInputElement>())
  const focusNext = useRef<[number, number] | null>([0, 0])
  const width = rows[0]?.length ?? 0

  useEffect(() => {
    if (!focusNext.current) return
    const [r, c] = focusNext.current
    focusNext.current = null
    cells.current.get(`${r}-${c}`)?.focus()
  })

  function setCell(r: number, c: number, value: string) {
    onChange(rows.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? value : cell)) : row)))
  }

  function addRow() {
    focusNext.current = [rows.length, 0]
    onChange([...rows, Array<string>(width).fill('')])
  }

  function addColumn() {
    focusNext.current = [0, width]
    onChange(rows.map((row) => [...row, '']))
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, r: number, c: number) {
    onCellKeyDown(event)
    if (event.defaultPrevented || event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    const next = c + 1 < width ? `${r}-${c + 1}` : `${r + 1}-0`
    cells.current.get(next)?.focus()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table aria-label="Tabelle" className="border-collapse">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className="p-0.5">
                    <input
                      ref={(el) => {
                        if (el) cells.current.set(`${r}-${c}`, el)
                        else cells.current.delete(`${r}-${c}`)
                      }}
                      aria-label={`Zeile ${r + 1}, Spalte ${c + 1}`}
                      value={cell}
                      onChange={(event) => setCell(r, c, event.target.value)}
                      onKeyDown={(event) => onKeyDown(event, r, c)}
                      enterKeyHint="next"
                      // The first column takes the labels (as in the derivation), so it is a bit wider.
                      className={`${c === 0 ? 'w-32' : 'w-24'} rounded-tile border border-primary bg-surface px-2 py-1 text-base text-ink`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={compact} onClick={addRow}>
          + Zeile
        </button>
        <button type="button" className={compact} onClick={addColumn}>
          + Spalte
        </button>
        <button
          type="button"
          className={compact}
          disabled={rows.length < 2}
          onClick={() => onChange(rows.slice(0, -1))}
        >
          − Zeile
        </button>
        <button
          type="button"
          className={compact}
          disabled={width < 2}
          onClick={() => onChange(rows.map((row) => row.slice(0, -1)))}
        >
          − Spalte
        </button>
        <button type="button" className={buttonClass('tertiary', { size: 'compact' })} onClick={onRemove}>
          Tabelle entfernen
        </button>
      </div>
    </div>
  )
}
