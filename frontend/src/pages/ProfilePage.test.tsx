import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '../routes/ProtectedRoute'
import { useAuthStore } from '../store/authStore'
import { ProfilePage } from './ProfilePage'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Same nesting as App.tsx — ProfilePage sits behind ProtectedRoute there, so a
// session refresh that flips the store's isLoading would unmount it (and drop
// its local success/error state). Rendering it bare would hide exactly that.
function renderProfilePage() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="/login" element={<p>Login page</p>} />
        <Route path="/start" element={<p>Start page</p>} />
        <Route path="/" element={<p>Landing page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function baseUser(overrides: Partial<Record<string, unknown>> = {}) {
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

const emptyProgress: unknown[] = []

function calledSessionRefresh(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.some(
    ([u, i]) => String(u).endsWith('/auth/me') && (i as RequestInit | undefined)?.method === undefined,
  )
}

describe('ProfilePage', () => {
  afterEach(() => {
    // Unmount first: resetting the store below changes the user, which keys
    // (and so remounts) ProgressSummarySection — with fetch already unstubbed,
    // that remount would hit the real network and its late 401 would clear the
    // next test's user via the unauthorized handler.
    cleanup()
    vi.unstubAllGlobals()
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })
  })

  it('shows the current display name and "Mitglied seit"', () => {
    useAuthStore.setState({
      user: baseUser({ first_name: 'Anna', last_name: 'Beispiel' }),
      isAuthenticated: true,
      isLoading: false,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(emptyProgress)))

    renderProfilePage()

    expect(screen.getByText('Anna Beispiel')).toBeInTheDocument()
    expect(screen.getByText(/Mitglied seit/)).toBeInTheDocument()
  })

  it('saves personal info, keeps the success message and updates the store from the PATCH response', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: baseUser(), isAuthenticated: true, isLoading: false })
    const updatedUser = baseUser({ first_name: 'Anna', last_name: 'Beispiel', gender: 'weiblich' })
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/progress/summary')) return jsonResponse(emptyProgress)
      if (url.endsWith('/auth/me') && init?.method === 'PATCH') return jsonResponse(updatedUser)
      return jsonResponse({ detail: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderProfilePage()
    await user.type(screen.getByLabelText('Vorname'), 'Anna')
    await user.type(screen.getByLabelText('Nachname'), 'Beispiel')
    await user.selectOptions(screen.getByLabelText('Geschlecht'), 'weiblich')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByText('Gespeichert.')).toBeInTheDocument()
    expect(useAuthStore.getState().user).toMatchObject({ first_name: 'Anna', last_name: 'Beispiel' })
    expect(screen.getByText('Anna Beispiel')).toBeInTheDocument()
    // The PATCH response is the fresh User — no extra GET /auth/me round trip.
    expect(calledSessionRefresh(fetchMock)).toBe(false)
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([u, i]) => {
          if (!String(u).endsWith('/auth/me') || i?.method !== 'PATCH') return false
          const body = JSON.parse(String(i.body))
          return body.first_name === 'Anna' && body.last_name === 'Beispiel' && body.gender === 'weiblich'
        }),
      ).toBe(true)
    })
  })

  it('shows an error message when saving personal info fails', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: baseUser(), isAuthenticated: true, isLoading: false })
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/progress/summary')) return jsonResponse(emptyProgress)
      if (url.endsWith('/auth/me') && init?.method === 'PATCH') return jsonResponse({ detail: 'nope' }, 400)
      return jsonResponse({ detail: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderProfilePage()
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByText('Die Angaben konnten nicht gespeichert werden.')).toBeInTheDocument()
  })

  it('saves a picked exam variant', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: baseUser(), isAuthenticated: true, isLoading: false })
    const updatedUser = baseUser({ exam_variant: 'motor' })
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/progress/summary')) return jsonResponse(emptyProgress)
      if (url.endsWith('/auth/me') && init?.method === 'PATCH') return jsonResponse(updatedUser)
      return jsonResponse({ detail: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderProfilePage()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Variante' }), 'motor')

    await waitFor(() => {
      expect(useAuthStore.getState().user?.exam_variant).toBe('motor')
    })
  })

  it('requests an email change and shows the code step', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: baseUser(), isAuthenticated: true, isLoading: false })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/progress/summary')) return jsonResponse(emptyProgress)
      if (url.endsWith('/auth/me/email/request')) return jsonResponse({ detail: 'accepted' }, 202)
      return jsonResponse({ detail: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderProfilePage()
    await user.type(screen.getByLabelText('Neue E-Mail-Adresse'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: 'Code anfordern' }))

    expect(await screen.findByText('Code gesendet an new@example.com.')).toBeInTheDocument()
  })

  it('shows an error when the new email address is already taken', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: baseUser(), isAuthenticated: true, isLoading: false })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/progress/summary')) return jsonResponse(emptyProgress)
      if (url.endsWith('/auth/me/email/request')) return jsonResponse({ detail: 'already in use' }, 409)
      return jsonResponse({ detail: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderProfilePage()
    await user.type(screen.getByLabelText('Neue E-Mail-Adresse'), 'taken@example.com')
    await user.click(screen.getByRole('button', { name: 'Code anfordern' }))

    expect(await screen.findByText('Diese E-Mail-Adresse wird bereits verwendet.')).toBeInTheDocument()
  })

  it('explains when the new email address is not allowed to sign in', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: baseUser(), isAuthenticated: true, isLoading: false })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/progress/summary')) return jsonResponse(emptyProgress)
      if (url.endsWith('/auth/me/email/request')) return jsonResponse({ detail: 'not allowed' }, 403)
      return jsonResponse({ detail: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderProfilePage()
    await user.type(screen.getByLabelText('Neue E-Mail-Adresse'), 'outsider@example.com')
    await user.click(screen.getByRole('button', { name: 'Code anfordern' }))

    expect(
      await screen.findByText('Mit dieser E-Mail-Adresse ist derzeit keine Anmeldung möglich.'),
    ).toBeInTheDocument()
  })

  it('verifies an email change, updates the store and keeps the success message', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: baseUser(), isAuthenticated: true, isLoading: false })
    const updatedUser = baseUser({ email: 'new@example.com' })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/progress/summary')) return jsonResponse(emptyProgress)
      if (url.endsWith('/auth/me/email/request')) return jsonResponse({ detail: 'accepted' }, 202)
      if (url.endsWith('/auth/me/email/verify')) return jsonResponse(updatedUser)
      return jsonResponse({ detail: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderProfilePage()
    await user.type(screen.getByLabelText('Neue E-Mail-Adresse'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: 'Code anfordern' }))
    await screen.findByText('Code gesendet an new@example.com.')
    await user.type(screen.getByLabelText('Bestätigungscode'), '123456')
    await user.click(screen.getByRole('button', { name: 'Bestätigen' }))

    expect(await screen.findByText('E-Mail-Adresse geändert.')).toBeInTheDocument()
    expect(useAuthStore.getState().user?.email).toBe('new@example.com')
    expect(calledSessionRefresh(fetchMock)).toBe(false)
  })

  it('shows an error when the verification code is invalid', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: baseUser(), isAuthenticated: true, isLoading: false })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/progress/summary')) return jsonResponse(emptyProgress)
      if (url.endsWith('/auth/me/email/request')) return jsonResponse({ detail: 'accepted' }, 202)
      if (url.endsWith('/auth/me/email/verify')) return jsonResponse({ detail: 'Invalid or expired code' }, 400)
      return jsonResponse({ detail: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderProfilePage()
    await user.type(screen.getByLabelText('Neue E-Mail-Adresse'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: 'Code anfordern' }))
    await screen.findByText('Code gesendet an new@example.com.')
    await user.type(screen.getByLabelText('Bestätigungscode'), '000000')
    await user.click(screen.getByRole('button', { name: 'Bestätigen' }))

    expect(await screen.findByText('Der Code ist ungültig oder abgelaufen.')).toBeInTheDocument()
  })

  it('gates the delete-confirm button until the email matches', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: baseUser(), isAuthenticated: true, isLoading: false })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(emptyProgress)))

    renderProfilePage()
    await user.click(screen.getByRole('button', { name: 'Account löschen' }))

    const confirmButton = screen.getByRole('button', { name: 'Endgültig löschen' })
    expect(confirmButton).toBeDisabled()

    await user.type(screen.getByLabelText(/Zur Bestätigung/), 'learner@example.com')
    expect(confirmButton).toBeEnabled()
  })

  it('deletes the account and navigates to the landing page', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: baseUser(), isAuthenticated: true, isLoading: false })
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/progress/summary')) return jsonResponse(emptyProgress)
      if (url.endsWith('/auth/me') && init?.method === 'DELETE') return new Response(null, { status: 204 })
      return jsonResponse({ detail: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderProfilePage()
    await user.click(screen.getByRole('button', { name: 'Account löschen' }))
    await user.type(screen.getByLabelText(/Zur Bestätigung/), 'learner@example.com')
    await user.click(screen.getByRole('button', { name: 'Endgültig löschen' }))

    expect(await screen.findByText('Landing page')).toBeInTheDocument()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    // The account is already gone server-side — no pointless POST /auth/logout.
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/auth/logout'))).toBe(false)
  })
})
