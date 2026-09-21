import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { AdminSettingsPage } from './AdminSettingsPage'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/settings']}>
      <Routes>
        <Route path="/admin/settings" element={<AdminSettingsPage />} />
        <Route path="/admin" element={<p>Admin page</p>} />
        <Route path="/start" element={<p>Start page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function setSession(isAdmin: boolean) {
  useAuthStore.setState({
    user: {
      id: 1,
      email: 'admin@example.com',
      created_at: '2026-01-01T00:00:00Z',
      exam_variant: null,
      first_name: null,
      last_name: null,
      gender: null,
      ai_grading_enabled: false,
      ads_removed: false,
      ai_checks_remaining: 20,
      is_admin: isAdmin,
    },
    isAuthenticated: true,
    isLoading: false,
  })
}

describe('AdminSettingsPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })
  })

  it('redirects a non-admin to /start', () => {
    setSession(false)
    renderPage()
    expect(screen.getByText('Start page')).toBeInTheDocument()
  })

  it('loads the default and saves a changed one', async () => {
    const user = userEvent.setup()
    setSession(true)
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      jsonResponse({ ai_checks_weekly_default: init?.method === 'PUT' ? 40 : 100 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderPage()
    const input = await screen.findByLabelText('KI-Prüfungen pro Woche (Standard)')
    await vi.waitFor(() => expect(input).toHaveValue(100))

    await user.clear(input)
    await user.type(input, '40')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByText('Gespeichert.')).toBeInTheDocument()
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ ai_checks_weekly_default: 40 })
  })

  it('rejects a blank or negative number without calling the API', async () => {
    const user = userEvent.setup()
    setSession(true)
    const fetchMock = vi.fn(async () => jsonResponse({ ai_checks_weekly_default: 100 }))
    vi.stubGlobal('fetch', fetchMock)

    renderPage()
    const input = await screen.findByLabelText('KI-Prüfungen pro Woche (Standard)')
    await vi.waitFor(() => expect(input).toHaveValue(100))
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(screen.getByText('Bitte eine ganze Zahl ab 0 eingeben.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1) // only the initial load
  })

  it('shows an error when loading or saving fails', async () => {
    const user = userEvent.setup()
    setSession(true)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'PUT' ? jsonResponse({}, 500) : jsonResponse({ ai_checks_weekly_default: 100 }),
      ),
    )
    renderPage()
    const input = await screen.findByLabelText('KI-Prüfungen pro Woche (Standard)')
    await vi.waitFor(() => expect(input).toHaveValue(100))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByText('Die Einstellung konnte nicht gespeichert werden.')).toBeInTheDocument()
  })

  it('shows an error when the settings cannot be loaded', async () => {
    setSession(true)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({}, 500)),
    )
    renderPage()
    expect(await screen.findByText('Die Einstellungen konnten nicht geladen werden.')).toBeInTheDocument()
  })
})
