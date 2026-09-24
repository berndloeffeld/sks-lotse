import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { ProtectedRoute } from './ProtectedRoute'

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/learn']}>
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/learn" element={<p>Learn page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({ sessionError: false })
  })

  it('shows a loading state while the session check is pending', () => {
    useAuthStore.setState({ isLoading: true, isAuthenticated: false })

    renderProtected()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('redirects to /login when not authenticated', () => {
    useAuthStore.setState({ isLoading: false, isAuthenticated: false })

    renderProtected()

    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('renders the protected content when authenticated', () => {
    useAuthStore.setState({ isLoading: false, isAuthenticated: true })

    renderProtected()

    expect(screen.getByText('Learn page')).toBeInTheDocument()
  })

  it('offers a retry instead of redirecting when the session check failed', async () => {
    const checkSession = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({ isLoading: false, isAuthenticated: false, sessionError: true, checkSession })

    renderProtected()

    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(checkSession).toHaveBeenCalledOnce()
  })
})
