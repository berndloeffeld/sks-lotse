import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { ProtectedRoute } from './ProtectedRoute'

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/start']}>
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/start" element={<p>Start page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
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

    expect(screen.getByText('Start page')).toBeInTheDocument()
  })
})
