import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { ProfileLearnStatusPage } from './ProfileLearnStatusPage'
import { jsonResponse, makeUser } from '../test/fixtures'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="/profile" element={<ProfileLearnStatusPage />} />
        <Route path="/learn" element={<p>Learn page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const emptyProgress: unknown[] = []

describe('ProfileLearnStatusPage', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })
  })

  it('shows the Lernstand overview with a link to the topics on /learn, without the variant picker', async () => {
    useAuthStore.setState({ user: makeUser(), isAuthenticated: true, isLoading: false })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(emptyProgress)))

    renderPage()

    expect(screen.getByRole('heading', { name: 'Gesamtfortschritt' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Alle Themen ansehen/ })).toHaveAttribute('href', '/learn')
    expect(screen.queryByText('Lernstand wird geladen…')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Prüfungsvariante' })).not.toBeInTheDocument()
  })

  it('shows an error when the Lernstand fails to load', async () => {
    useAuthStore.setState({ user: makeUser(), isAuthenticated: true, isLoading: false })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'boom' }, 500)))

    renderPage()

    expect(await screen.findByText('Der Lernstand konnte nicht geladen werden.')).toBeInTheDocument()
  })
})
