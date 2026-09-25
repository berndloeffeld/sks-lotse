import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '../routes/ProtectedRoute'
import { useAuthStore } from '../store/authStore'
import { LearnPage } from './LearnPage'
import { jsonResponse, makeUser } from '../test/fixtures'

function renderLearnPage(entry = '/learn') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        {/* Same nesting as App.tsx, so a page remount caused by the store's
            isLoading flipping would show up here too. */}
        <Route element={<ProtectedRoute />}>
          <Route path="/learn" element={<LearnPage />} />
        </Route>
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
    learning_questions: 1,
    is_focus: false,
  },
]

describe('LearnPage', () => {
  afterEach(() => {
    // Unmount first: resetting the store below changes the user, which keys
    // (and so remounts) ProgressSummarySection, and that remount's late fetch
    // would land in the next test.
    cleanup()
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })
  })

  it('shows the current exam variant and the Lernstand', async () => {
    useAuthStore.setState({
      user: makeUser({ exam_variant: 'motor' }),
      isAuthenticated: true,
      isLoading: false,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(progressSummary)))

    renderLearnPage()

    expect(await screen.findByText('Gesamtfortschritt')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveValue('motor')
  })

  it('shows the category pie and the topics grouped by subject', async () => {
    useAuthStore.setState({ user: makeUser({ exam_variant: 'motor' }), isAuthenticated: true, isLoading: false })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(progressSummary)))

    renderLearnPage()

    expect(await screen.findByText('Ankern')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Fachgebiete' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Navigation' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lernen starten' })).toHaveAttribute('href', '/learn/navigation/ankern')
  })

  it('shows an error instead of the topics when the Lernstand fails to load', async () => {
    useAuthStore.setState({ user: makeUser({ exam_variant: 'motor' }), isAuthenticated: true, isLoading: false })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'boom' }, 500)))

    renderLearnPage()

    expect(await screen.findByText('Der Lernstand konnte nicht geladen werden.')).toBeInTheDocument()
  })

  it('saves a picked exam variant', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({
      user: makeUser(),
      isAuthenticated: true,
      isLoading: false,
    })
    const updatedUser = makeUser({ exam_variant: 'motor' })
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
      user: makeUser(),
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

  it('marks a topic as Fokus with the star and reloads the Lernstand', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: makeUser(), isAuthenticated: true, isLoading: false })
    let focused = false
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/progress/focus/navigation/ankern') && init?.method === 'PUT') {
        focused = true
        return new Response(null, { status: 204 })
      }
      if (url.endsWith('/progress/summary')) return jsonResponse([{ ...progressSummary[0], is_focus: focused }])
      return jsonResponse({ detail: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderLearnPage()
    await user.click(await screen.findByRole('tab', { name: 'Fokus' }))
    expect(await screen.findByText(/Markiere Themen mit dem Stern/)).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Nach Thema' }))
    await user.click(screen.getByRole('button', { name: 'Als Fokus markieren: Ankern' }))
    // The star flips once the reloaded Lernstand arrives; the topic then shows up in the Fokus tab
    // with its "sicher"/"teilweise"/"offen" counts.
    expect(await screen.findByRole('button', { name: 'Fokus entfernen: Ankern' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Fokus' }))

    expect(await screen.findByText('2 sicher gelernt · 1 teilweise · 4 offen (von 7 Fragen)')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Fokus entfernen: Ankern (Navigation)' })).toHaveLength(1)
  })

  it('removes a Fokus topic with the star', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: makeUser(), isAuthenticated: true, isLoading: false })
    let focused = true
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/progress/focus/navigation/ankern') && init?.method === 'DELETE') {
        focused = false
        return new Response(null, { status: 204 })
      }
      if (url.endsWith('/progress/summary')) return jsonResponse([{ ...progressSummary[0], is_focus: focused }])
      return jsonResponse({ detail: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderLearnPage('/learn?modus=focus')
    await user.click(await screen.findByRole('button', { name: 'Fokus entfernen: Ankern (Navigation)' }))

    expect(await screen.findByText(/Markiere Themen mit dem Stern/)).toBeInTheDocument()
  })

  it('keeps the Lernstand and shows an error when the Fokus cannot be saved', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: makeUser(), isAuthenticated: true, isLoading: false })
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/progress/focus/')) return jsonResponse({ detail: 'Topic is already fully learned' }, 409)
      if (url.endsWith('/progress/summary')) return jsonResponse(progressSummary)
      return jsonResponse({ detail: 'not found' }, init ? 500 : 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderLearnPage()
    await user.click(await screen.findByRole('button', { name: 'Als Fokus markieren: Ankern' }))

    expect(await screen.findByText('Der Fokus konnte nicht gespeichert werden.')).toBeInTheDocument()
    expect(screen.getByText('Ankern')).toBeInTheDocument()
  })

  it('opens on the topic list and switches modes, keeping the mode in the URL', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: makeUser(), isAuthenticated: true, isLoading: false })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith('/progress/refresh/summary')) return jsonResponse({ lapsed: 2, expiring: 1, fresh: 3 })
        if (url.endsWith('/progress/summary')) return jsonResponse(progressSummary)
        return jsonResponse({ detail: 'not found' }, 404)
      }),
    )

    renderLearnPage()

    expect(await screen.findByRole('tab', { name: 'Nach Thema', selected: true })).toBeInTheDocument()
    expect(await screen.findByText('Ankern')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Auffrischen' }))

    expect(await screen.findByText(/2 möglicherweise verblasst/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Auffrischen starten' })).toHaveAttribute('href', '/learn/refresh')
    expect(screen.queryByText('Ankern')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Nach Thema' }))
    expect(await screen.findByText('Ankern')).toBeInTheDocument()
  })

  it('shows no start button when the Auffrischen counts cannot be loaded', async () => {
    useAuthStore.setState({ user: makeUser(), isAuthenticated: true, isLoading: false })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith('/progress/summary')
          ? jsonResponse(progressSummary)
          : jsonResponse({ detail: 'boom' }, 500),
      ),
    )

    renderLearnPage('/learn?modus=refresh')

    expect(await screen.findByText(/Sobald du Fragen sicher gelernt hast/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Auffrischen starten' })).not.toBeInTheDocument()
  })

  it('has no back link: Lernen is a top-level destination in the header', async () => {
    useAuthStore.setState({
      user: makeUser(),
      isAuthenticated: true,
      isLoading: false,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([])))

    renderLearnPage()

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Zurück/ })).not.toBeInTheDocument()
  })
})
