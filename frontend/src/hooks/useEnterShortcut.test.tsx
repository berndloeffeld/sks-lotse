import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { useEnterShortcut } from './useEnterShortcut'

// A matchMedia whose answer the test can flip, as a tablet does when a mouse is plugged in.
function mockPointer(fine: boolean) {
  const listeners = new Set<() => void>()
  const query = {
    matches: fine,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }
  const matchMedia = vi.fn(() => query)
  vi.stubGlobal('matchMedia', matchMedia)
  return {
    matchMedia,
    listeners,
    change(nowFine: boolean) {
      query.matches = nowFine
      act(() => listeners.forEach((listener) => listener()))
    },
  }
}

function Field() {
  const [sent, setSent] = useState(0)
  const shortcut = useEnterShortcut(() => setSent((count) => count + 1))
  return (
    <>
      <textarea aria-label="Antwort" onKeyDown={shortcut.onKeyDown} />
      {shortcut.enabled ? <span>Hinweis</span> : null}
      <p data-testid="sent">{sent}</p>
    </>
  )
}

function field() {
  return screen.getByLabelText<HTMLTextAreaElement>('Antwort')
}

describe('useEnterShortcut', () => {
  it('runs the action on Enter with a fine pointer, and Shift+Enter breaks the line', async () => {
    const pointer = mockPointer(true)
    render(<Field />)
    const user = userEvent.setup()

    await user.type(field(), 'eins{Shift>}{Enter}{/Shift}zwei{Enter}')

    expect(pointer.matchMedia).toHaveBeenCalledWith('(hover: hover) and (pointer: fine)')
    expect(field()).toHaveValue('eins\nzwei')
    expect(screen.getByTestId('sent')).toHaveTextContent('1')
    expect(screen.getByText('Hinweis')).toBeInTheDocument()
  })

  it('leaves Enter a line break on touch and hides the hint', async () => {
    mockPointer(false)
    render(<Field />)
    const user = userEvent.setup()

    await user.type(field(), 'eins{Enter}zwei')

    expect(field()).toHaveValue('eins\nzwei')
    expect(screen.getByTestId('sent')).toHaveTextContent('0')
    expect(screen.queryByText('Hinweis')).not.toBeInTheDocument()
  })

  it('ignores the Enter that confirms an IME composition', () => {
    mockPointer(true)
    render(<Field />)

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, isComposing: true })
    act(() => {
      field().dispatchEvent(event)
    })

    expect(event.defaultPrevented).toBe(false)
    expect(screen.getByTestId('sent')).toHaveTextContent('0')
  })

  it('ignores keys other than Enter', async () => {
    mockPointer(true)
    render(<Field />)

    await userEvent.setup().type(field(), 'a{Tab}')

    expect(screen.getByTestId('sent')).toHaveTextContent('0')
  })

  it('follows a change of the pointer and stops listening on unmount', async () => {
    const pointer = mockPointer(false)
    const { unmount } = render(<Field />)

    pointer.change(true)
    expect(screen.getByText('Hinweis')).toBeInTheDocument()
    await userEvent.setup().type(field(), 'x{Enter}')
    expect(screen.getByTestId('sent')).toHaveTextContent('1')

    unmount()
    expect(pointer.listeners.size).toBe(0)
  })

  it('keeps the shortcut on where there is no matchMedia', async () => {
    vi.stubGlobal('matchMedia', undefined)
    render(<Field />)

    await userEvent.setup().type(field(), 'x{Enter}')

    expect(screen.getByTestId('sent')).toHaveTextContent('1')
    expect(screen.getByText('Hinweis')).toBeInTheDocument()
  })
})
