import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ReportQuestion } from './ReportQuestion'

describe('ReportQuestion', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete window.umami
  })

  it('starts collapsed and can be cancelled', async () => {
    const user = userEvent.setup()
    render(<ReportQuestion questionId={7} />)

    expect(screen.queryByLabelText('Was ist das Problem?')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fehler in dieser Frage melden' }))
    expect(screen.getByLabelText('Was ist das Problem?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.queryByLabelText('Was ist das Problem?')).not.toBeInTheDocument()
  })

  it('opens as a dialog with focus on the first field and closes on Escape, returning focus to the flag', async () => {
    const user = userEvent.setup()
    render(<ReportQuestion questionId={7} />)

    const flag = screen.getByRole('button', { name: 'Fehler in dieser Frage melden' })
    await user.click(flag)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Was ist das Problem?')).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(flag).toHaveFocus()
  })

  it('sends the category and comment, then thanks the learner', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 1 }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const track = vi.fn()
    window.umami = { track }
    render(<ReportQuestion questionId={7} />)

    await user.click(screen.getByRole('button', { name: 'Fehler in dieser Frage melden' }))
    await user.selectOptions(screen.getByLabelText('Was ist das Problem?'), 'typo')
    await user.type(screen.getByLabelText('Anmerkung (optional)'), 'Zeile 2')
    await user.click(screen.getByRole('button', { name: 'Meldung senden' }))

    expect(await screen.findByText('Danke für deine Meldung!')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/api\/v1\/questions\/7\/report$/)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ category: 'typo', comment: 'Zeile 2' })
    // Only the coarse category is tracked, never the free text.
    expect(track).toHaveBeenCalledWith('question_reported', { category: 'typo' })
  })

  it('shows an error and keeps the form when sending fails', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ detail: 'nope' }), { status: 500 })),
    )
    render(<ReportQuestion questionId={7} />)

    await user.click(screen.getByRole('button', { name: 'Fehler in dieser Frage melden' }))
    await user.click(screen.getByRole('button', { name: 'Meldung senden' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Meldung konnte nicht gesendet werden')
    expect(screen.getByLabelText('Was ist das Problem?')).toBeInTheDocument()
  })
})
