import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { StartPage } from './StartPage'
import { makeUser } from '../test/fixtures'

function renderStartPage() {
  return render(
    <MemoryRouter initialEntries={['/start']}>
      <Routes>
        <Route path="/start" element={<StartPage />} />
        <Route path="/" element={<p>Landing page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('StartPage', () => {
  it("shows the logged-in learner's email and the nav tiles", () => {
    useAuthStore.setState({
      user: makeUser(),
      isAuthenticated: true,
      isLoading: false,
    })

    renderStartPage()

    expect(screen.getByText('learner@example.com')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lernen' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Lernen/ })).toHaveAttribute('href', '/learn')
    expect(screen.getByRole('heading', { name: 'Prüfungssimulation' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Prüfungssimulation/ })).toHaveAttribute('href', '/exam')
  })

  it('shows the display name instead of the email once one is set, and links to /profile', () => {
    useAuthStore.setState({
      user: makeUser({ first_name: 'Anna', last_name: 'Beispiel' }),
      isAuthenticated: true,
      isLoading: false,
    })

    renderStartPage()

    expect(screen.getByText('Anna Beispiel')).toBeInTheDocument()
    expect(screen.queryByText('learner@example.com')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profil' })).toHaveAttribute('href', '/profile')
  })

  it('logs out and returns to the landing page', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({
      user: makeUser(),
      isAuthenticated: true,
      isLoading: false,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    renderStartPage()
    await user.click(screen.getByRole('button', { name: 'Abmelden' }))

    expect(await screen.findByText('Landing page')).toBeInTheDocument()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})
