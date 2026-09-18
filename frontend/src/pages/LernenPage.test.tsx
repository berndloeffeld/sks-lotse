import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { LernenPage } from './LernenPage'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function renderLernenPage() {
  return render(
    <MemoryRouter initialEntries={['/lernen']}>
      <Routes>
        <Route path="/lernen" element={<LernenPage />} />
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

describe('LernenPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })
  })

  it('shows the current exam variant, overall progress, and the Lernstand grouped by subject', async () => {
    useAuthStore.setState({
      user: {
        id: 1,
        email: 'learner@example.com',
        created_at: '2026-01-01T00:00:00Z',
        exam_variant: 'motor',
        is_admin: false,
      },
      isAuthenticated: true,
      isLoading: false,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(progressSummary)))

    renderLernenPage()

    expect(await screen.findByText('Ankern')).toBeInTheDocument()
    // Appears twice: once in the aggregate tile, once in Ankern's own row
    // (the only topic in this fixture, so both read the same numbers).
    expect(screen.getAllByText('2 von 7 Fragen gelernt')).toHaveLength(2)
    expect(screen.getByText('Navigation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lernen starten' })).toBeDisabled()

    // Overall progress tile aggregates across every topic.
    expect(screen.getByText('Gesamtfortschritt')).toBeInTheDocument()
    expect(screen.getByText('29%')).toBeInTheDocument()

    expect(screen.getByRole('combobox')).toHaveValue('motor')
  })

  it('shows an empty state when no topics are scoped in yet', async () => {
    useAuthStore.setState({
      user: {
        id: 1,
        email: 'learner@example.com',
        created_at: '2026-01-01T00:00:00Z',
        exam_variant: null,
        is_admin: false,
      },
      isAuthenticated: true,
      isLoading: false,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([])))

    renderLernenPage()

    expect(await screen.findByText('Keine Themen gefunden.')).toBeInTheDocument()
  })

  it('saves a picked exam variant and reloads the Lernstand', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({
      user: {
        id: 1,
        email: 'learner@example.com',
        created_at: '2026-01-01T00:00:00Z',
        exam_variant: null,
        is_admin: false,
      },
      isAuthenticated: true,
      isLoading: false,
    })
    const updatedUser = {
      id: 1,
      email: 'learner@example.com',
      created_at: '2026-01-01T00:00:00Z',
      exam_variant: 'motor',
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/progress/summary')) return jsonResponse(progressSummary)
      if (url.endsWith('/auth/me') && init?.method === 'PATCH') return jsonResponse(updatedUser)
      if (url.endsWith('/auth/me')) return jsonResponse(updatedUser)
      return jsonResponse({ detail: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderLernenPage()
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
      user: {
        id: 1,
        email: 'learner@example.com',
        created_at: '2026-01-01T00:00:00Z',
        exam_variant: null,
        is_admin: false,
      },
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

    renderLernenPage()
    await screen.findByText('Ankern')

    await user.selectOptions(screen.getByRole('combobox'), 'motor')

    expect(await screen.findByText('Die Prüfungsvariante konnte nicht gespeichert werden.')).toBeInTheDocument()
  })

  it('links back to /start', async () => {
    useAuthStore.setState({
      user: {
        id: 1,
        email: 'learner@example.com',
        created_at: '2026-01-01T00:00:00Z',
        exam_variant: null,
        is_admin: false,
      },
      isAuthenticated: true,
      isLoading: false,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([])))

    renderLernenPage()

    expect(screen.getByRole('link', { name: /Zurück/ })).toHaveAttribute('href', '/start')
  })
})
