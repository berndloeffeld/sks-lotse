import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { AdminLayout } from './AdminLayout'
import { makeUser } from '../test/fixtures'

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
  })

  it('redirects a non-admin to /learn', () => {
    setSession(false)
    renderAdmin('/admin/users')
    expect(screen.getByText('Learn page')).toBeInTheDocument()
    expect(screen.queryByText('Users page')).not.toBeInTheDocument()
  })

  it('opens the user list for /admin', () => {
    setSession(true)
    renderAdmin('/admin')
    expect(screen.getByText('Users page')).toBeInTheDocument()
  })

  it('shows the section tabs and marks the current one, also on a sub-page', () => {
    setSession(true)
    renderAdmin('/admin/users/42')
    expect(screen.getByText('User page')).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Admin-Bereiche' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Benutzer' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Fragen' })).toHaveAttribute('href', '/admin/questions')
    expect(screen.getByRole('link', { name: 'Fragen' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Einstellungen' })).toHaveAttribute('href', '/admin/settings')
  })
})
