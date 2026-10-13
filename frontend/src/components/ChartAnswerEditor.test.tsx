import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { EMPTY_DRAFT, type ChartAnswerDraft } from '../answerTable'
import { ChartAnswerEditor } from './ChartAnswerEditor'

const TABLE = [
  ['HW', '08:53', '3,2 m'],
  ['NW', '15:10', '0,4 m'],
]

function Editor({ initial }: { initial: ChartAnswerDraft }) {
  const [draft, setDraft] = useState(initial)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  return (
    <>
      <ChartAnswerEditor
        draft={draft}
        onChange={setDraft}
        fieldId="answer"
        fieldRef={fieldRef}
        describedBy="hint"
        onKeyDown={vi.fn()}
      />
      <output aria-label="Stand">{JSON.stringify(draft.table)}</output>
    </>
  )
}

function renderEditor(table: string[][] | null = TABLE) {
  render(<Editor initial={{ ...EMPTY_DRAFT, table }} />)
  return userEvent.setup()
}

const tableNow = () => JSON.parse(screen.getByRole('status', { name: 'Stand' }).textContent ?? 'null') as string[][]
const cell = (r: number, c: number) => screen.getByRole('textbox', { name: `Zeile ${r}, Spalte ${c}` })

describe('ChartAnswerEditor', () => {
  it('inserts a column left or right of the one whose grip was used', async () => {
    const user = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Spalte 2 bearbeiten' }))
    const menu = screen.getByRole('menu', { name: 'Spalte 2' })
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Spalte links einfügen', 'Spalte rechts einfügen', 'Spalte löschen'])
    expect(screen.getByRole('button', { name: 'Spalte 2 bearbeiten' })).toHaveAttribute('aria-expanded', 'true')
    await user.click(within(menu).getByRole('menuitem', { name: 'Spalte rechts einfügen' }))

    expect(tableNow()).toEqual([
      ['HW', '08:53', '', '3,2 m'],
      ['NW', '15:10', '', '0,4 m'],
    ])
    expect(cell(1, 3)).toHaveFocus()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Spalte 1 bearbeiten' }))
    await user.click(screen.getByRole('menuitem', { name: 'Spalte links einfügen' }))
    expect(tableNow()[0]).toEqual(['', 'HW', '08:53', '', '3,2 m'])
    expect(cell(1, 1)).toHaveFocus()
  })

  it('marks what a menu entry would change while it is pointed at', async () => {
    const user = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Spalte 2 bearbeiten' }))
    // The grip's column is selected while its menu is open.
    expect(cell(1, 2).closest('td')).toHaveClass('bg-primary/15')
    expect(cell(1, 3).closest('td')).not.toHaveClass('bg-primary/15')

    await user.hover(screen.getByRole('menuitem', { name: 'Spalte löschen' }))
    expect(cell(1, 2).closest('td')).toHaveClass('bg-danger/15')
    expect(cell(2, 2).closest('td')).toHaveClass('bg-danger/15')

    await user.hover(screen.getByRole('menuitem', { name: 'Spalte links einfügen' }))
    expect(cell(1, 2).closest('td')?.className).toContain('shadow-[inset_3px_0_0_var(--color-primary)]')
    await user.hover(screen.getByRole('menuitem', { name: 'Spalte rechts einfügen' }))
    expect(cell(1, 2).closest('td')?.className).toContain('shadow-[inset_-3px_0_0_var(--color-primary)]')
  })

  it('deletes a row, but never the last one and never the last value column', async () => {
    const user = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Zeile 1 bearbeiten' }))
    await user.click(screen.getByRole('menuitem', { name: 'Zeile löschen' }))
    expect(tableNow()).toEqual([['NW', '15:10', '0,4 m']])
    expect(cell(1, 1)).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Zeile 1 bearbeiten' }))
    expect(screen.getByRole('menuitem', { name: 'Zeile löschen' })).toBeDisabled()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Spalte 3 bearbeiten' }))
    await user.click(screen.getByRole('menuitem', { name: 'Spalte löschen' }))
    expect(tableNow()).toEqual([['NW', '15:10']])
    await user.click(screen.getByRole('button', { name: 'Spalte 1 bearbeiten' }))
    expect(screen.getByRole('menuitem', { name: 'Spalte löschen' })).toBeDisabled()
  })

  it('adds a row or a column at the end with "+"', async () => {
    const user = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Spalte anhängen' }))
    expect(tableNow()[0]).toEqual(['HW', '08:53', '3,2 m', ''])
    expect(cell(1, 4)).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Zeile anhängen' }))
    expect(tableNow()).toHaveLength(3)
    expect(cell(3, 1)).toHaveFocus()
  })

  it("opens a cell's menu with its row and column on a right click", async () => {
    const user = renderEditor()

    await user.pointer({ keys: '[MouseRight]', target: cell(2, 2) })
    const menu = screen.getByRole('menu', { name: 'Zeile 2, Spalte 2' })
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(6)
    expect(within(menu).getByRole('menuitem', { name: 'Zeile oberhalb einfügen' })).toHaveFocus()

    await user.keyboard('{ArrowDown}{Enter}')
    expect(tableNow()).toEqual([...TABLE, ['', '', '']])
    expect(cell(3, 1)).toHaveFocus()
  })

  it('walks the menu with the arrow keys and closes it with Escape, back where it came from', async () => {
    const user = renderEditor()

    await user.pointer({ keys: '[MouseRight]', target: cell(1, 2) })
    // A cell's menu marks nothing until an entry is chosen; moving to one marks what it changes.
    expect(cell(1, 2).closest('td')).not.toHaveClass('bg-primary/15')
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Spalte löschen' })).toHaveFocus()
    expect(cell(2, 2).closest('td')).toHaveClass('bg-danger/15')
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Zeile oberhalb einfügen' })).toHaveFocus()
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(cell(1, 2)).toHaveFocus()
    expect(tableNow()).toEqual(TABLE)
  })

  it('closes the menu on a click elsewhere, changing nothing', async () => {
    const user = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Zeile 2 bearbeiten' }))
    await user.click(screen.getByRole('textbox', { name: 'Text unter der Tabelle' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(tableNow()).toEqual(TABLE)
  })

  it('moves to the next cell on Enter where the answer shortcut leaves the key', async () => {
    const user = renderEditor()

    await user.click(cell(1, 3))
    await user.keyboard('{Enter}')
    expect(cell(2, 1)).toHaveFocus()
  })
})
