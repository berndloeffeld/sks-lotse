import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { User } from '../api/types'
import { useAuthStore } from '../store/authStore'
import { AI_CHECK_MAX_ANSWER_CHARS, AiAnswerCheck } from './AiAnswerCheck'

const user: User = {
  id: 1,
  email: 'learner@example.com',
  created_at: '2026-01-01T00:00:00Z',
  exam_variant: null,
  first_name: null,
  last_name: null,
  gender: null,
  is_admin: false,
  ai_grading_enabled: true,
  ads_removed: false,
  ai_checks_remaining: 14,
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const ROW = { name: /Antwort vom Lotsen bewerten lassen/ }

describe('AiAnswerCheck', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    delete window.umami
  })

  it('is dimmed with "bald verfügbar" without the unlock and never calls the backend', () => {
    useAuthStore.setState({ user: { ...user, ai_grading_enabled: false } })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<AiAnswerCheck questionId={7} answer="links" onSuggest={vi.fn()} />)

    const row = screen.getByRole('button', ROW)
    expect(row).toBeDisabled()
    expect(row).toHaveTextContent('bald verfügbar')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the remaining budget and needs a written answer', () => {
    useAuthStore.setState({ user })
    const { rerender } = render(<AiAnswerCheck questionId={7} answer="  " onSuggest={vi.fn()} />)
    expect(screen.getByRole('button', ROW)).toBeDisabled()
    expect(screen.getByRole('button', ROW)).toHaveTextContent('Schreibe zuerst eine Antwort')

    rerender(<AiAnswerCheck questionId={7} answer="links" onSuggest={vi.fn()} />)
    expect(screen.getByRole('button', ROW)).toBeEnabled()
    expect(screen.getByRole('button', ROW)).toHaveTextContent('noch 14 diese Woche')
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

  it('is disabled with "ab Montag wieder" once the week is used up', () => {
    useAuthStore.setState({ user: { ...user, ai_checks_remaining: 0 } })
    render(<AiAnswerCheck questionId={7} answer="links" onSuggest={vi.fn()} />)

    expect(screen.getByRole('button', ROW)).toBeDisabled()
    expect(screen.getByRole('button', ROW)).toHaveTextContent('ab Montag wieder')
  })

  it('sends only the answer, shows the feedback, suggests the grade and updates the budget', async () => {
    useAuthStore.setState({ user })
    const fetchMock = vi.fn(async () =>
      jsonResponse({ outcome: 'teilweise_richtig', feedback: 'Es fehlt die Seite.', remaining_this_week: 13 }),
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
    expect(useAuthStore.getState().user?.ai_checks_remaining).toBe(13)
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
    expect(useAuthStore.getState().user?.ai_checks_remaining).toBe(14)
  })
})
