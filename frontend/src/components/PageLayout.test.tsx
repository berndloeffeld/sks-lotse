import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { PageLayout } from './PageLayout'

function renderLayout(props: Partial<Parameters<typeof PageLayout>[0]> = {}) {
  return render(
    <MemoryRouter>
      <PageLayout title="Titel" {...props}>
        <p>Inhalt</p>
      </PageLayout>
    </MemoryRouter>,
  )
}

describe('PageLayout', () => {
  it('renders title, subtitle, content and the legal footer, without a back link', () => {
    useAuthStore.setState({ user: null })
    renderLayout({ subtitle: 'Untertitel' })

    expect(screen.getByRole('heading', { level: 1, name: 'Titel' })).toBeInTheDocument()
    expect(screen.getByText('Untertitel')).toBeInTheDocument()
    // Every page is reachable from the header, so no page carries a "← Zurück" link.
    expect(screen.queryByRole('link', { name: /Zurück/ })).not.toBeInTheDocument()
    expect(screen.getByText('Inhalt')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/imprint')
  })

  it('shows the account nav and links the brand to /learn by default', () => {
    useAuthStore.setState({ user: null })
    renderLayout()

    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('link', { name: 'SKS Lotse – Startseite' })).toHaveAttribute('href', '/learn')
    expect(within(banner).getByRole('link', { name: 'Lernen' })).toHaveAttribute('href', '/learn')
    expect(within(banner).getByRole('button', { name: 'Menü' })).toBeInTheDocument()
  })

  it('shows an Anmelden link on public pages and no nav at all with nav="none"', () => {
    const { unmount } = renderLayout({ nav: 'public' })
    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('link', { name: 'SKS Lotse – Startseite' })).toHaveAttribute('href', '/')
    expect(within(banner).getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/login')
    unmount()

    renderLayout({ nav: 'none' })
    expect(within(screen.getByRole('banner')).getAllByRole('link')).toHaveLength(1)
  })

  it('shows the account nav on public pages once logged in', () => {
    useAuthStore.setState({ user: null, isAuthenticated: true })
    renderLayout({ nav: 'public' })

    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('link', { name: 'SKS Lotse – Startseite' })).toHaveAttribute('href', '/learn')
    expect(within(banner).queryByRole('link', { name: 'Anmelden' })).not.toBeInTheDocument()
    expect(within(banner).getByRole('button', { name: 'Menü' })).toBeInTheDocument()
    useAuthStore.setState({ isAuthenticated: false })
  })
})
