import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '../store/authStore'
import { AI_CHECK_MAX_ANSWER_CHARS, AiAnswerCheck } from './AiAnswerCheck'
import { jsonResponse, makeUser } from '../test/fixtures'

const user = makeUser({ token_balance: 1 })

const ROW = { name: /Antwort vom Lotsen bewerten lassen/ }

describe('AiAnswerCheck', () => {
  afterEach(() => {
    cleanup()
    delete window.umami
  })

  it('is dimmed with "bald verfügbar" without tokens and never calls the grading endpoint', () => {
    useAuthStore.setState({ user: { ...user, token_balance: 0 } })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<AiAnswerCheck questionId={7} answer="links" onSuggest={vi.fn()} />)

    const row = screen.getByRole('button', ROW)
    expect(row).toBeDisabled()
    expect(row).toHaveTextContent('bald verfügbar')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('links to the pricing page without tokens when the checkout is open to the account', () => {
    useAuthStore.setState({ user: { ...user, token_balance: 0, can_buy_tokens: true } })
    vi.stubGlobal('fetch', vi.fn())
    render(
      <MemoryRouter>
        <AiAnswerCheck questionId={7} answer="links" onSuggest={vi.fn()} />
      </MemoryRouter>,
    )

    const row = screen.getByRole('button', ROW)
    expect(row).toBeDisabled()
    expect(row).toHaveTextContent('Keine Tokens mehr')
    expect(row).toHaveAttribute('title', 'Keine Tokens mehr')
    expect(screen.getByRole('link', { name: 'Tokens kaufen' })).toHaveAttribute('href', '/pricing')
  })

  it('shows the token balance and needs a written answer', () => {
    useAuthStore.setState({ user })
    const { rerender } = render(<AiAnswerCheck questionId={7} answer="  " onSuggest={vi.fn()} />)
    expect(screen.getByRole('button', ROW)).toBeDisabled()
    expect(screen.getByRole('button', ROW)).toHaveTextContent('Schreibe zuerst eine Antwort')

    rerender(<AiAnswerCheck questionId={7} answer="links" onSuggest={vi.fn()} />)
    expect(screen.getByRole('button', ROW)).toBeEnabled()
    expect(screen.getByRole('button', ROW)).toHaveTextContent('1 Token(s)')
  })

  it('is disabled for an answer longer than the check accepts, and says so', () => {
    useAuthStore.setState({ user })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<AiAnswerCheck questionId={7} answer={'x'.repeat(AI_CHECK_MAX_ANSWER_CHARS + 1)} onSuggest={vi.fn()} />)

    const row = screen.getByRole('button', ROW)
    expect(row).toBeDisabled()
    expect(row).toHaveTextContent('Nur für Antworten bis 1000 Zeichen')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('accepts an answer of exactly the maximum length', () => {
    useAuthStore.setState({ user })
    render(<AiAnswerCheck questionId={7} answer={'x'.repeat(AI_CHECK_MAX_ANSWER_CHARS)} onSuggest={vi.fn()} />)

    expect(screen.getByRole('button', ROW)).toBeEnabled()
  })

  it('explains a rejected answer instead of claiming the Lotse is unreachable', async () => {
    useAuthStore.setState({ user })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'too long' }, 422)),
    )
    render(<AiAnswerCheck questionId={7} answer="links" onSuggest={vi.fn()} />)

    await userEvent.setup().click(screen.getByRole('button', ROW))

    expect(await screen.findByRole('alert')).toHaveTextContent('Diese Antwort kann der Lotse nicht prüfen.')
  })

  it('sends only the answer, shows the feedback, suggests the grade and updates the token balance', async () => {
    useAuthStore.setState({ user })
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        outcome: 'teilweise_richtig',
        feedback: 'Es fehlt die Seite.',
        tokens_remaining: 0,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const track = vi.fn()
    window.umami = { track }
    const onSuggest = vi.fn()
    render(<AiAnswerCheck questionId={7} answer="links" onSuggest={onSuggest} />)

    // What happens to the answer is announced via the description/tooltip, not a caption.
    expect(screen.getByRole('button', ROW)).toHaveAccessibleDescription(/an Anthropic gesendet/)
    await userEvent.setup().click(screen.getByRole('button', ROW))

    expect(await screen.findByText('Es fehlt die Seite.')).toBeInTheDocument()
    expect(screen.getByText('Lotsen-Vorschlag: Teilweise Richtig')).toBeInTheDocument()
    expect(onSuggest).toHaveBeenCalledWith('teilweise_richtig')
    expect(track).toHaveBeenCalledWith('ai_check_used', undefined)
    expect(useAuthStore.getState().user?.token_balance).toBe(0)
    // The suggestion takes the button's place; the caller (via onSuggest) is responsible for
    // scrolling it into view, since only it knows where the "Weiter" button ended up.
    expect(screen.queryByRole('button', ROW)).not.toBeInTheDocument()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/api\/v1\/questions\/7\/ai-grade$/)
    expect(JSON.parse(String(init.body))).toEqual({ answer: 'links' })
  })

  it.each([
    [429, /ausgelastet/],
    [503, /nicht erreichbar/],
  ])('explains a %i and leaves self-assessment possible', async (status, message) => {
    useAuthStore.setState({ user })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'x' }, status)),
    )
    const onSuggest = vi.fn()
    render(<AiAnswerCheck questionId={7} answer="links" onSuggest={onSuggest} />)

    await userEvent.setup().click(screen.getByRole('button', ROW))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(onSuggest).not.toHaveBeenCalled()
    expect(useAuthStore.getState().user?.token_balance).toBe(1)
  })
})
