import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { ProfileLayout } from './ProfileLayout'
import { makeUser } from '../test/fixtures'

// The same nesting as App.tsx, with stub pages for the two tabs.
function renderProfile(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/profile" element={<ProfileLayout />}>
          <Route index element={<p>Lernstand page</p>} />
          <Route path="account" element={<p>Konto page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProfileLayout', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })
  })

  it('shows the current display name and "Mitglied seit"', () => {
    useAuthStore.setState({
      user: makeUser({ first_name: 'Anna', last_name: 'Beispiel' }),
      isAuthenticated: true,
      isLoading: false,
    })

    renderProfile('/profile')

    expect(screen.getByText('Anna Beispiel')).toBeInTheDocument()
    expect(screen.getByText(/Mitglied seit/)).toBeInTheDocument()
  })

  it('renders the Lernstand tab by default', () => {
    useAuthStore.setState({ user: makeUser(), isAuthenticated: true, isLoading: false })

    renderProfile('/profile')

    expect(screen.getByText('Lernstand page')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lernstand' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Konto' })).not.toHaveAttribute('aria-current')
  })

  it('renders the Konto tab and marks it current', () => {
    useAuthStore.setState({ user: makeUser(), isAuthenticated: true, isLoading: false })

    renderProfile('/profile/account')

    expect(screen.getByText('Konto page')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Konto' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Lernstand' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Lernstand' })).toHaveAttribute('href', '/profile')
  })
})
