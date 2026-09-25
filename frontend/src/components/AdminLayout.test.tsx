import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { AdminLayout } from './AdminLayout'
import { jsonResponse, makeUser } from '../test/fixtures'

function stubMfaStatus(status: { enrolled: boolean; verified: boolean }) {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(status))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function setSession(isAdmin: boolean) {
  useAuthStore.setState({
    user: makeUser({ is_admin: isAdmin }),
    isAuthenticated: true,
    isLoading: false,
  })
}

// The same nesting as App.tsx, with stub pages.
function renderAdmin(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users" element={<p>Users page</p>} />
          <Route path="users/:id" element={<p>User page</p>} />
          <Route path="questions" element={<p>Questions page</p>} />
        </Route>
        <Route path="/learn" element={<p>Learn page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminLayout', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })
    vi.unstubAllGlobals()
  })

  it('redirects a non-admin to /learn, without asking for the 2FA status', () => {
    const fetchMock = stubMfaStatus({ enrolled: true, verified: true })
    setSession(false)
    renderAdmin('/admin/users')
    expect(screen.getByText('Learn page')).toBeInTheDocument()
    expect(screen.queryByText('Users page')).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('offers the 2FA setup to an admin without one, and no admin page', async () => {
    stubMfaStatus({ enrolled: false, verified: false })
    setSession(true)
    renderAdmin('/admin/users')
    expect(screen.getByText('Lädt …')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Zwei-Faktor-Anmeldung einrichten' })).toBeInTheDocument()
    expect(screen.queryByText('Users page')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Admin-Bereiche' })).not.toBeInTheDocument()
  })

  it('asks an enrolled admin for a code before any admin page', async () => {
    stubMfaStatus({ enrolled: true, verified: false })
    setSession(true)
    renderAdmin('/admin/users')
    expect(await screen.findByRole('heading', { name: 'Code bestätigen' })).toBeInTheDocument()
    expect(screen.queryByText('Users page')).not.toBeInTheDocument()
  })

  it('shows the pages again once the code was accepted', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ enrolled: true, verified: false }))
      .mockResolvedValueOnce(jsonResponse({ access_token: 't', token_type: 'bearer' }))
      .mockResolvedValueOnce(jsonResponse({ enrolled: true, verified: true }))
    vi.stubGlobal('fetch', fetchMock)
    setSession(true)
    renderAdmin('/admin/users')

    await userEvent.type(await screen.findByLabelText('Code aus der Authenticator-App'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))

    expect(await screen.findByText('Users page')).toBeInTheDocument()
  })

  it('says so when the 2FA status cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'x' }, 500)))
    setSession(true)
    renderAdmin('/admin/users')
    expect(await screen.findByRole('alert')).toHaveTextContent('Der Admin-Bereich konnte nicht geladen werden.')
  })

  it('opens the user list for /admin', async () => {
    stubMfaStatus({ enrolled: true, verified: true })
    setSession(true)
    renderAdmin('/admin')
    expect(await screen.findByText('Users page')).toBeInTheDocument()
  })

  it('shows the section tabs and marks the current one, also on a sub-page', async () => {
    stubMfaStatus({ enrolled: true, verified: true })
    setSession(true)
    renderAdmin('/admin/users/42')
    expect(await screen.findByText('User page')).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Admin-Bereiche' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Benutzer' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Fragen' })).toHaveAttribute('href', '/admin/questions')
    expect(screen.getByRole('link', { name: 'Fragen' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Einstellungen' })).toHaveAttribute('href', '/admin/settings')
  })
})
