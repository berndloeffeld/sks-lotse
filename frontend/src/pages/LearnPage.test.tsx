import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { LearnPage } from './LearnPage'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function renderLearnPage() {
  return render(
    <MemoryRouter initialEntries={['/learn']}>
      <Routes>
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/start" element={<p>Start page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const progressSummary = [
  {
    subject: 'navigation',
    topic_slug: 'ankern',
    topic_name: 'Ankern',
    display_order: 1,
    total_questions: 7,
    learned_questions: 2,
  },
]

function baseUser(overrides: Partial<{ exam_variant: string | null }> = {}) {
  return {
    id: 1,
    email: 'learner@example.com',
    created_at: '2026-01-01T00:00:00Z',
    exam_variant: null,
    first_name: null,
    last_name: null,
    gender: null,
    is_admin: false,
    ...overrides,
  }
}

describe('LearnPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })
  })

  it('shows the current exam variant and the Lernstand', async () => {
    useAuthStore.setState({
      user: baseUser({ exam_variant: 'motor' }),
      isAuthenticated: true,
      isLoading: false,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(progressSummary)))

    renderLearnPage()

    expect(await screen.findByText('Ankern')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveValue('motor')
  })

  it('saves a picked exam variant', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({
      user: baseUser(),
      isAuthenticated: true,
      isLoading: false,
    })
    const updatedUser = baseUser({ exam_variant: 'motor' })
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/progress/summary')) return jsonResponse(progressSummary)
      if (url.endsWith('/auth/me') && init?.method === 'PATCH') return jsonResponse(updatedUser)
      if (url.endsWith('/auth/me')) return jsonResponse(updatedUser)
      return jsonResponse({ detail: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderLearnPage()
    await screen.findByText('Ankern')

    await user.selectOptions(screen.getByRole('combobox'), 'motor')

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith('/auth/me') && i?.method === 'PATCH')).toBe(true)
    })
    expect(useAuthStore.getState().user?.exam_variant).toBe('motor')
  })

  it('shows an error message when the exam-variant update fails', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({
      user: baseUser(),
      isAuthenticated: true,
      isLoading: false,
    })
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/progress/summary')) return jsonResponse(progressSummary)
      if (url.endsWith('/auth/me') && init?.method === 'PATCH') return jsonResponse({ detail: 'nope' }, 400)
      return jsonResponse({ detail: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderLearnPage()
    await screen.findByText('Ankern')

    await user.selectOptions(screen.getByRole('combobox'), 'motor')

    expect(await screen.findByText('Die Prüfungsvariante konnte nicht gespeichert werden.')).toBeInTheDocument()
  })

  it('links back to /start', async () => {
    useAuthStore.setState({
      user: baseUser(),
      isAuthenticated: true,
      isLoading: false,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([])))

    renderLearnPage()

    expect(screen.getByRole('link', { name: /Zurück/ })).toHaveAttribute('href', '/start')
  })
})
