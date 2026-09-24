import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { MaintenancePage } from './MaintenancePage'
import { useAuthStore } from '../store/authStore'

describe('MaintenancePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the heading and links to the legal pages that stay reachable', () => {
    render(
      <MemoryRouter>
        <MaintenancePage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Wartungsarbeiten', level: 1 })).toBeInTheDocument()
    // Scoped to <main>: PageLayout's footer also carries Impressum/AGB links.
    const main = within(screen.getByRole('main'))
    expect(main.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/imprint')
    expect(main.getByRole('link', { name: 'Datenschutzerklärung' })).toHaveAttribute('href', '/privacy')
    expect(main.getByRole('link', { name: 'AGB' })).toHaveAttribute('href', '/agb')
  })

  it('"Erneut prüfen" re-checks the session, the only way the flag can clear while gated', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'ok' }), { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    render(
      <MemoryRouter>
        <MaintenancePage />
      </MemoryRouter>,
    )

    screen.getByRole('button', { name: 'Erneut prüfen' }).click()

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/auth/me'), expect.anything()),
    )
    expect(useAuthStore.getState().isLoading).toBe(false)
  })
})
