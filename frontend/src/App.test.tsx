import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import App, { AppRoutes } from './App'
import { useMaintenanceStore } from './store/maintenanceStore'
import { jsonResponse } from './test/fixtures'

describe('App', () => {
  afterEach(() => {
    useMaintenanceStore.setState({ maintenanceMode: false })
  })

  it('renders the landing page at the root route and checks the session on mount', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ detail: 'Not authenticated' }, 401))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Sicher durch die SKS-Theorie' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/auth/me'), expect.anything())
  })

  it('shows the maintenance page instead of the landing page when the backend is in maintenance mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ detail: 'Wartung' }, 503, { 'X-Maintenance-Mode': '1' })),
    )

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Wartungsarbeiten' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Sicher durch die SKS-Theorie' })).not.toBeInTheDocument()
  })

  it('keeps the Impressum reachable even in maintenance mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ detail: 'Wartung' }, 503, { 'X-Maintenance-Mode': '1' })),
    )

    render(
      <MemoryRouter initialEntries={['/imprint']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Impressum' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Wartungsarbeiten' })).not.toBeInTheDocument()
  })
})
