import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { StartPage } from './StartPage'

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
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows the logged-in learner's email and the nav tiles", () => {
    useAuthStore.setState({
      user: {
        id: 1,
        email: 'learner@example.com',
        created_at: '2026-01-01T00:00:00Z',
        exam_variant: null,
        is_admin: false,
      },
      isAuthenticated: true,
      isLoading: false,
    })

    renderStartPage()

    expect(screen.getByText('learner@example.com')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lernen' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Lernen/ })).toHaveAttribute('href', '/learn')
    expect(screen.getByRole('heading', { name: 'Prüfungssimulation' })).toBeInTheDocument()
  })

  it('logs out and returns to the landing page', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({
      user: {
        id: 1,
        email: 'learner@example.com',
        created_at: '2026-01-01T00:00:00Z',
        exam_variant: null,
        is_admin: false,
      },
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
