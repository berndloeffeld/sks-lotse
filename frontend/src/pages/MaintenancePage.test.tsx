import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { MaintenancePage } from './MaintenancePage'
import { useAuthStore } from '../store/authStore'

describe('MaintenancePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the heading, with the legal pages reachable only once via the shared footer', () => {
    render(
      <MemoryRouter>
        <MaintenancePage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Wartungsarbeiten', level: 1 })).toBeInTheDocument()
    // PageLayout's LegalFooter already links these on every page — MaintenancePage must not
    // duplicate them (regression guard for a duplicate-links bug caught after shipping).
    expect(screen.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/imprint')
    expect(screen.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'AGB' })).toHaveAttribute('href', '/agb')
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
