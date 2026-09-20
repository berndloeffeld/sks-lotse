import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { User } from '../api/types'
import { useAuthStore } from '../store/authStore'
import { AiAnswerCheck } from './AiAnswerCheck'

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
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const BUTTON = { name: 'Lotsen-Check' }

describe('AiAnswerCheck', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    delete window.umami
  })

  it('shows a disabled teaser without the unlock and never calls the backend', async () => {
    useAuthStore.setState({ user: { ...user, ai_grading_enabled: false } })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<AiAnswerCheck questionId={7} answer="links" onSuggest={vi.fn()} />)

    expect(screen.getByRole('button', BUTTON)).toBeDisabled()
    expect(screen.getByText('KI-Prüfung deiner Antwort – bald verfügbar.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('needs a written answer before the check can start', () => {
    useAuthStore.setState({ user })
    render(<AiAnswerCheck questionId={7} answer="  " onSuggest={vi.fn()} />)

    expect(screen.getByRole('button', BUTTON)).toBeDisabled()
    expect(screen.getByText(/Schreibe zuerst eine Antwort/)).toBeInTheDocument()
  })

  it('sends only the answer, shows the feedback and suggests the grade', async () => {
    useAuthStore.setState({ user })
    const fetchMock = vi.fn(async () => jsonResponse({ outcome: 'teilweise_richtig', feedback: 'Es fehlt die Seite.' }))
    vi.stubGlobal('fetch', fetchMock)
    const track = vi.fn()
    window.umami = { track }
    const onSuggest = vi.fn()
    render(<AiAnswerCheck questionId={7} answer="links" onSuggest={onSuggest} />)

    await userEvent.setup().click(screen.getByRole('button', BUTTON))

    expect(await screen.findByText('Es fehlt die Seite.')).toBeInTheDocument()
    expect(screen.getByText('Lotsen-Vorschlag: Teilweise Richtig')).toBeInTheDocument()
    expect(onSuggest).toHaveBeenCalledWith('teilweise_richtig')
    expect(track).toHaveBeenCalledWith('ai_check_used', undefined)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/api\/v1\/questions\/7\/ai-grade$/)
    expect(JSON.parse(String(init.body))).toEqual({ answer: 'links' })
  })

  it.each([
    [429, /Limit/],
    [503, /nicht verfügbar/],
  ])('explains a %i and leaves self-assessment possible', async (status, message) => {
    useAuthStore.setState({ user })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'x' }, status)),
    )
    const onSuggest = vi.fn()
    render(<AiAnswerCheck questionId={7} answer="links" onSuggest={onSuggest} />)

    await userEvent.setup().click(screen.getByRole('button', BUTTON))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(onSuggest).not.toHaveBeenCalled()
  })
})
