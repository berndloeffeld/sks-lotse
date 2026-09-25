import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('shows the Lernstand overview with a link to the topics on /learn', async () => {
    useAuthStore.setState({ user: makeUser(), isAuthenticated: true, isLoading: false })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(emptyProgress)))

    renderPage()

    expect(screen.getByRole('heading', { name: 'Gesamtfortschritt' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Alle Themen ansehen/ })).toHaveAttribute('href', '/learn')
    expect(screen.queryByText('Lernstand wird geladen…')).not.toBeInTheDocument()
  })

  it('shows an error when the Lernstand fails to load', async () => {
    useAuthStore.setState({ user: makeUser(), isAuthenticated: true, isLoading: false })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'boom' }, 500)))

    renderPage()

    expect(await screen.findByText('Der Lernstand konnte nicht geladen werden.')).toBeInTheDocument()
  })

  it('saves a picked exam variant', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: makeUser(), isAuthenticated: true, isLoading: false })
    const updatedUser = makeUser({ exam_variant: 'motor' })
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/progress/summary')) return jsonResponse(emptyProgress)
      if (url.endsWith('/auth/me') && init?.method === 'PATCH') return jsonResponse(updatedUser)
      return jsonResponse({ detail: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderPage()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Variante' }), 'motor')

    await waitFor(() => {
      expect(useAuthStore.getState().user?.exam_variant).toBe('motor')
    })
  })
})
