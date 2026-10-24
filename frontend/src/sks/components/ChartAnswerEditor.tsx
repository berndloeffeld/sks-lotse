import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'

import {
  MIN_COLUMNS,
  MIN_ROWS,
  deleteColumn,
  deleteRow,
  insertColumn,
  insertRow,
  type ChartAnswerDraft,
} from '../answerTable'

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

type Axis = 'row' | 'column'
// What a menu acts on, and what the table marks while it is open: the row or column it selects, where
// an entry would insert (`before`/`after`), or what it would delete.
interface Mark {
  axis: Axis
  index: number
  mode: 'select' | 'before' | 'after' | 'delete'
}
interface MenuItem {
  label: string
  icon: ReactNode
  mark: Mark
  disabled: boolean
  // The table after the change, and the cell to put the cursor in.
  apply: () => [string[][], [number, number]]
}
interface OpenMenu {
  label: string
  items: MenuItem[]
  // The row or column a grip selected; none for a cell's menu.
  selected: Mark | null
  x: number
  y: number
  returnFocus: HTMLElement | null
}

const MENU_WIDTH = 224

const tool =
  'inline-flex items-center gap-1.5 rounded-tile px-2 py-1 font-mono text-xs tracking-wide text-primary uppercase hover:bg-surface-alt'
// The fields grow with their text (where the browser can), so the frame has no resize handles inside.
const text = 'block w-full resize-none bg-transparent px-3 py-2 text-base text-ink outline-none field-sizing-content'
// Grips and "+" show while the pointer is over the table or the cursor in it.
const reveal = 'opacity-0 transition-opacity group-hover/table:opacity-100 group-focus-within/table:opacity-100'

// One frame, after an editor like Confluence's but much plainer: a tool bar on top, the text, and a
// table inside the same frame, so it is plainly part of the answer. The table's first column holds the
// labels (as in the official derivation), set off as a header column. Rows and columns are changed at
// the table itself: a grip above each column and beside each row opens its menu, "+" adds one at the
// end, and a cell's context menu (right click, or the context-menu key) has both.
export function ChartAnswerEditor({
  draft,
  onChange,
  fieldId,
  fieldRef,
  describedBy,
  onKeyDown,
}: ChartAnswerEditorProps) {
  const { table } = draft
  const frameRef = useRef<HTMLDivElement>(null)
  const cells = useRef(new Map<string, HTMLInputElement>())
  const focusCell = useRef<[number, number] | null>(null)
  const [menu, setMenu] = useState<OpenMenu | null>(null)
  const [preview, setPreview] = useState<Mark | null>(null)
  const rowCount = table?.length ?? 0
  const width = table?.[0]?.length ?? 0
  const mark = preview ?? menu?.selected ?? null

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

  function rowItems(rows: string[][], r: number): MenuItem[] {
    return [
      {
        label: 'Zeile oberhalb einfügen',
        icon: <Arrow direction="up" />,
        mark: { axis: 'row', index: r, mode: 'before' },
        disabled: false,
        apply: () => [insertRow(rows, r), [r, 0]],
      },
      {
        label: 'Zeile unterhalb einfügen',
        icon: <Arrow direction="down" />,
        mark: { axis: 'row', index: r, mode: 'after' },
        disabled: false,
        apply: () => [insertRow(rows, r + 1), [r + 1, 0]],
      },
      {
        label: 'Zeile löschen',
        icon: <TrashIcon />,
        mark: { axis: 'row', index: r, mode: 'delete' },
        disabled: rows.length <= MIN_ROWS,
        apply: () => [deleteRow(rows, r), [Math.min(r, rows.length - 2), 0]],
      },
    ]
  }

  function columnItems(rows: string[][], c: number): MenuItem[] {
    const columns = rows[0]?.length ?? 0
    return [
      {
        label: 'Spalte links einfügen',
        icon: <Arrow direction="left" />,
        mark: { axis: 'column', index: c, mode: 'before' },
        disabled: false,
        apply: () => [insertColumn(rows, c), [0, c]],
      },
      {
        label: 'Spalte rechts einfügen',
        icon: <Arrow direction="right" />,
        mark: { axis: 'column', index: c, mode: 'after' },
        disabled: false,
        apply: () => [insertColumn(rows, c + 1), [0, c + 1]],
      },
      {
        label: 'Spalte löschen',
        icon: <TrashIcon />,
        mark: { axis: 'column', index: c, mode: 'delete' },
        disabled: columns <= MIN_COLUMNS,
        apply: () => [deleteColumn(rows, c), [0, Math.min(c, columns - 2)]],
      },
    ]
  }

  // At a point on the screen, kept inside the frame.
  function openMenu(next: Omit<OpenMenu, 'x' | 'y'>, clientX: number, clientY: number) {
    const frame = frameRef.current?.getBoundingClientRect()
    const x = clientX - (frame?.left ?? 0)
    const y = clientY - (frame?.top ?? 0)
    const maxX = Math.max(0, (frame?.width ?? MENU_WIDTH) - MENU_WIDTH)
    setPreview(null)
    setMenu({ ...next, x: Math.min(Math.max(0, x), maxX), y })
  }

  function openGrip(rows: string[][], axis: Axis, index: number, grip: HTMLElement) {
    const at = grip.getBoundingClientRect()
    const label = axis === 'row' ? `Zeile ${index + 1}` : `Spalte ${index + 1}`
    const items = axis === 'row' ? rowItems(rows, index) : columnItems(rows, index)
    openMenu({ label, items, selected: { axis, index, mode: 'select' }, returnFocus: grip }, at.left, at.bottom + 4)
  }

  function closeMenu(restoreFocus: boolean) {
    if (restoreFocus) menu?.returnFocus?.focus()
    setMenu(null)
    setPreview(null)
  }

  function choose(item: MenuItem) {
    const [rows, focus] = item.apply()
    setMenu(null)
    setPreview(null)
    setTable(rows, focus)
  }

  function onCellKeyDown(event: KeyboardEvent<HTMLInputElement>, r: number, c: number) {
    onKeyDown(event)
    if (event.defaultPrevented || event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    cells.current.get(c + 1 < width ? `${r}-${c + 1}` : `${r + 1}-0`)?.focus()
  }

  function cellMark(r: number, c: number): string {
    if (!mark || (mark.axis === 'row' ? mark.index !== r : mark.index !== c)) return c === 0 ? 'bg-surface-alt' : ''
    const edge = {
      row: {
        before: 'shadow-[inset_0_3px_0_var(--color-primary)]',
        after: 'shadow-[inset_0_-3px_0_var(--color-primary)]',
      },
      column: {
        before: 'shadow-[inset_3px_0_0_var(--color-primary)]',
        after: 'shadow-[inset_-3px_0_0_var(--color-primary)]',
      },
    }[mark.axis]
    if (mark.mode === 'delete') return 'bg-danger/15'
    if (mark.mode === 'select') return 'bg-primary/15'
    return `bg-primary/10 ${edge[mark.mode]}`
  }

  return (
    <div
      ref={frameRef}
      className="relative rounded-tile border-2 border-primary bg-surface focus-within:ring-2 focus-within:ring-accent"
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-1 py-1">
        {table ? (
          <button type="button" className={tool} onClick={removeTable}>
            <TrashIcon />
            Tabelle entfernen
          </button>
        ) : (
          <button type="button" className={tool} onClick={() => setTable(EMPTY_TABLE, [0, 0])}>
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
          <div className="group/table overflow-x-auto px-1 py-1">
            <table aria-label="Tabelle" className="border-collapse">
              <tbody>
                <tr>
                  <td />
                  {table[0]?.map((_, c) => (
                    <td key={c} className="px-0.5 pb-1">
                      <Grip
                        label={`Spalte ${c + 1} bearbeiten`}
                        axis="column"
                        active={menu?.selected?.axis === 'column' && menu.selected.index === c}
                        onOpen={(grip) => openGrip(table, 'column', c, grip)}
                      />
                    </td>
                  ))}
                  <td />
                </tr>
                {table.map((row, r) => (
                  <tr key={r}>
                    <td className="py-0.5 pr-1">
                      <Grip
                        label={`Zeile ${r + 1} bearbeiten`}
                        axis="row"
                        active={menu?.selected?.axis === 'row' && menu.selected.index === r}
                        onOpen={(grip) => openGrip(table, 'row', r, grip)}
                      />
                    </td>
                    {row.map((cell, c) => {
                      const Cell = c === 0 ? 'th' : 'td'
                      return (
                        <Cell
                          key={c}
                          scope={c === 0 ? 'row' : undefined}
                          className={`border border-border p-0 ${cellMark(r, c)}`}
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
                                table.map((values, i) =>
                                  i === r ? values.map((v, j) => (j === c ? event.target.value : v)) : values,
                                ),
                              )
                            }
                            onKeyDown={(event) => onCellKeyDown(event, r, c)}
                            onContextMenu={(event) => {
                              event.preventDefault()
                              // From the keyboard, the event has no pointer position: open at the cell.
                              const at = event.currentTarget.getBoundingClientRect()
                              const fromKeyboard = event.clientX === 0 && event.clientY === 0
                              openMenu(
                                {
                                  label: `Zeile ${r + 1}, Spalte ${c + 1}`,
                                  items: [...rowItems(table, r), ...columnItems(table, c)],
                                  selected: null,
                                  returnFocus: event.currentTarget,
                                },
                                fromKeyboard ? at.left : event.clientX,
                                fromKeyboard ? at.bottom : event.clientY,
                              )
                            }}
                            enterKeyHint="next"
                            className={`${c === 0 ? 'w-32 font-semibold sm:w-40' : 'w-24 sm:w-28'} bg-transparent px-2 py-1.5 text-left text-base text-ink outline-none focus:outline-2 focus:-outline-offset-2 focus:outline-primary`}
                          />
                        </Cell>
                      )
                    })}
                    {r === 0 ? (
                      <td rowSpan={rowCount} className="pl-1 align-middle">
                        <AddButton
                          label="Spalte anhängen"
                          onClick={() => setTable(insertColumn(table, width), [0, width])}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
                <tr>
                  <td />
                  <td colSpan={width} className="pt-1 text-center">
                    <AddButton
                      label="Zeile anhängen"
                      onClick={() => setTable(insertRow(table, rowCount), [rowCount, 0])}
                    />
                  </td>
                </tr>
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
      {menu ? <TableMenu menu={menu} onChoose={choose} onPreview={setPreview} onClose={closeMenu} /> : null}
    </div>
  )
}

// A grip opens its row's or column's menu. Out of the Tab order, so Tab goes from cell to cell; from
// the keyboard the cell's context menu has the same entries.
function Grip({
  label,
  axis,
  active,
  onOpen,
}: {
  label: string
  axis: Axis
  active: boolean
  onOpen: (grip: HTMLElement) => void
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={active}
      onClick={(event) => onOpen(event.currentTarget)}
      className={`flex items-center justify-center rounded border ${
        axis === 'column' ? 'mx-auto h-3 w-8' : 'h-7 w-3'
      } ${active ? 'border-primary bg-primary text-surface opacity-100' : `border-border bg-surface-alt text-ink-soft hover:border-primary ${reveal}`}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 12 4"
        className={`w-2.5 ${axis === 'row' ? 'rotate-90' : ''}`}
        fill="currentColor"
      >
        <circle cx="2" cy="2" r="1" />
        <circle cx="6" cy="2" r="1" />
        <circle cx="10" cy="2" r="1" />
      </svg>
    </button>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex size-6 items-center justify-center rounded-full border border-border bg-surface text-primary hover:border-primary hover:bg-surface-alt ${reveal}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className="size-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M6 1.5v9M1.5 6h9" />
      </svg>
    </button>
  )
}

function TableMenu({
  menu,
  onChoose,
  onPreview,
  onClose,
}: {
  menu: OpenMenu
  onChoose: (item: MenuItem) => void
  onPreview: (mark: Mark | null) => void
  onClose: (restoreFocus: boolean) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  // The first entry takes the focus when the menu opens, but marks nothing yet: until the learner
  // points at an entry or moves to one, the table shows only what the grip selected.
  const opening = useRef(true)

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('[role=menuitem]:not(:disabled)')?.focus()
    opening.current = false
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close.current(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose(true)
    } else if (event.key === 'Tab') {
      onClose(false)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not(:disabled)') ?? [])]
      const at = items.indexOf(document.activeElement as HTMLButtonElement)
      const step = event.key === 'ArrowDown' ? 1 : items.length - 1
      items[(at + step) % items.length]?.focus()
    }
  }

  return (
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      aria-label={menu.label}
      onKeyDown={onKeyDown}
      style={{ left: menu.x, top: menu.y, width: MENU_WIDTH }}
      className="absolute z-(--z-popover) flex flex-col rounded-tile border border-ink bg-surface py-1 text-sm text-ink shadow-lg"
    >
      {menu.items.map((item, i) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => onChoose(item)}
          onPointerEnter={() => onPreview(item.mark)}
          onPointerLeave={() => onPreview(null)}
          onFocus={() => {
            if (!opening.current) onPreview(item.mark)
          }}
          className={`flex items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-alt focus:bg-surface-alt focus:outline-none disabled:opacity-40 disabled:hover:bg-transparent ${
            item.mark.mode === 'delete' ? 'text-danger' : ''
          } ${i > 0 && menu.items[i - 1]?.mark.axis !== item.mark.axis ? 'mt-1 border-t border-border pt-2' : ''}`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}

function Arrow({ direction }: { direction: 'up' | 'down' | 'left' | 'right' }) {
  const rotate = { up: '-rotate-90', down: 'rotate-90', left: 'rotate-180', right: '' }[direction]
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={`size-4 shrink-0 ${rotate}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2.5 8h10M9 4.5 12.5 8 9 11.5" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.75 9h6.5l.75-9" />
    </svg>
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
