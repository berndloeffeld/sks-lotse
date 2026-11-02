import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useModalFocus } from './useModalFocus'

function Dialog({
  onClose,
  focusHeading = false,
  empty = false,
}: {
  onClose?: () => void
  focusHeading?: boolean
  empty?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  useModalFocus(panelRef, { onClose, initialFocusRef: focusHeading ? headingRef : undefined })
  return createPortal(
    <div ref={panelRef} role="dialog" aria-label="Dialog">
      <h2 ref={headingRef} tabIndex={-1}>
        Titel
      </h2>
      {empty ? null : (
        <>
          <button type="button">Erster</button>
          <button type="button" disabled>
            Gesperrt
          </button>
          <button type="button">Letzter</button>
        </>
      )}
    </div>,
    document.body,
  )
}

function App({ open, ...props }: { open: boolean; onClose?: () => void; focusHeading?: boolean; empty?: boolean }) {
  return (
    <>
      <button type="button">Öffner</button>
      {open ? <Dialog {...props} /> : null}
    </>
  )
}

let root: HTMLDivElement

beforeEach(() => {
  root = document.createElement('div')
  root.id = 'root'
  document.body.appendChild(root)
})

afterEach(() => {
  root.remove()
  document.body.style.overflow = ''
})

function renderApp(props: Parameters<typeof App>[0]) {
  return render(<App {...props} />, { container: root })
}

describe('useModalFocus', () => {
  it('makes the app inert and unscrollable while open, and restores both on close', () => {
    document.body.style.overflow = 'auto'
    const { rerender } = renderApp({ open: true })
    expect(root).toHaveAttribute('inert')
    expect(document.body.style.overflow).toBe('hidden')

    rerender(<App open={false} />)
    expect(root).not.toHaveAttribute('inert')
    expect(document.body.style.overflow).toBe('auto')
  })

  it('starts on the first focusable element and returns focus to the opener on close', () => {
    const { rerender } = renderApp({ open: false })
    const opener = screen.getByRole('button', { name: 'Öffner' })
    opener.focus()

    rerender(<App open />)
    expect(screen.getByRole('button', { name: 'Erster' })).toHaveFocus()

    rerender(<App open={false} />)
    expect(opener).toHaveFocus()
  })

  it('starts on the given element instead', () => {
    renderApp({ open: true, focusHeading: true })
    expect(screen.getByRole('heading', { name: 'Titel' })).toHaveFocus()
  })

  it('cycles Tab and Shift+Tab inside the panel, skipping disabled buttons', async () => {
    const user = userEvent.setup()
    renderApp({ open: true })
    const first = screen.getByRole('button', { name: 'Erster' })
    const last = screen.getByRole('button', { name: 'Letzter' })

    await user.tab()
    expect(last).toHaveFocus()
    await user.tab()
    expect(first).toHaveFocus()
    await user.tab({ shift: true })
    expect(last).toHaveFocus()
    await user.tab({ shift: true })
    expect(first).toHaveFocus()
  })

  it('pulls focus back into the panel when it was outside', async () => {
    const user = userEvent.setup()
    renderApp({ open: true })
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Erster' })).toHaveFocus()
    outside.focus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Letzter' })).toHaveFocus()
    outside.remove()
  })

  it('keeps focus where it is when the panel has nothing to tab to', async () => {
    const user = userEvent.setup()
    renderApp({ open: true, empty: true, focusHeading: true })
    await user.tab()
    expect(screen.getByRole('heading', { name: 'Titel' })).toHaveFocus()
  })

  it('closes on Escape when it may be closed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderApp({ open: true, onClose })
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores Escape for a mandatory dialog', async () => {
    const user = userEvent.setup()
    const escape = vi.fn()
    document.addEventListener('keydown', escape)
    renderApp({ open: true })
    await user.keyboard('{Escape}')
    expect(escape.mock.calls[0][0].defaultPrevented).toBe(false)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    document.removeEventListener('keydown', escape)
  })

  it('ignores other keys', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderApp({ open: true, onClose })
    await user.keyboard('{Enter}')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Erster' })).toHaveFocus()
  })
})
