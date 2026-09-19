import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '../routes/ProtectedRoute'
import { useAuthStore } from '../store/authStore'
import { LearnPage } from './LearnPage'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function renderLearnPage() {
  return render(
    <MemoryRouter initialEntries={['/learn']}>
      <Routes>
        {/* Same nesting as App.tsx, so a page remount caused by the store's
            isLoading flipping would show up here too. */}
        <Route element={<ProtectedRoute />}>
          <Route path="/learn" element={<LearnPage />} />
        </Route>
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
    // Unmount first: resetting the store below changes the user, which keys
    // (and so remounts) ProgressSummarySection — with fetch already unstubbed,
    // that remount would hit the real network and its late 401 would clear the
    // next test's user via the unauthorized handler.
    cleanup()
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

    expect(await screen.findByText('Gesamtfortschritt')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveValue('motor')
  })

  it('shows the category pie and the topics grouped by subject', async () => {
    useAuthStore.setState({ user: baseUser({ exam_variant: 'motor' }), isAuthenticated: true, isLoading: false })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(progressSummary)))

    renderLearnPage()

    expect(await screen.findByText('Ankern')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Themen' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Fachgebiete' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Navigation' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lernen starten' })).toHaveAttribute('href', '/learn/navigation/ankern')
  })

  it('shows an error instead of the topics when the Lernstand fails to load', async () => {
    useAuthStore.setState({ user: baseUser({ exam_variant: 'motor' }), isAuthenticated: true, isLoading: false })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'boom' }, 500)))

    renderLearnPage()

    expect(await screen.findByText('Der Lernstand konnte nicht geladen werden.')).toBeInTheDocument()
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
      return jsonResponse({ detail: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderLearnPage()
    await screen.findByText('Gesamtfortschritt')

    await user.selectOptions(screen.getByRole('combobox'), 'motor')

    // Wait on the actual end state (the store reflecting the saved variant),
    // not just on the PATCH call having fired: fetchMock records a call the
    // instant fetch() is invoked, before its response resolves.
    await waitFor(() => {
      expect(useAuthStore.getState().user?.exam_variant).toBe('motor')
    })
    // Updated straight from the PATCH response: the page never dropped to
    // ProtectedRoute's loading state, and no extra GET /auth/me went out.
    expect(screen.queryByText('Lädt…')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith('/auth/me') && i?.method === undefined)).toBe(false)
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
    await screen.findByText('Gesamtfortschritt')

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
