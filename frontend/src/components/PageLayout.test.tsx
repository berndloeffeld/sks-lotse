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
  it('renders title, subtitle, back link, content and the legal footer', () => {
    useAuthStore.setState({ user: null })
    renderLayout({ subtitle: 'Untertitel', backTo: '/start' })

    expect(screen.getByRole('heading', { level: 1, name: 'Titel' })).toBeInTheDocument()
    expect(screen.getByText('Untertitel')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Zurück/ })).toHaveAttribute('href', '/start')
    expect(screen.getByText('Inhalt')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/imprint')
  })

  it('shows the account nav and links the brand to /start by default', () => {
    useAuthStore.setState({ user: null })
    renderLayout()

    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('link', { name: 'SKS Lotse – Startseite' })).toHaveAttribute('href', '/start')
    expect(within(banner).getByRole('link', { name: 'Profil' })).toHaveAttribute('href', '/profile')
    expect(within(banner).getByRole('button', { name: 'Abmelden' })).toBeInTheDocument()
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
    expect(within(banner).getByRole('link', { name: 'SKS Lotse – Startseite' })).toHaveAttribute('href', '/start')
    expect(within(banner).queryByRole('link', { name: 'Anmelden' })).not.toBeInTheDocument()
    expect(within(banner).getByRole('button', { name: 'Abmelden' })).toBeInTheDocument()
    useAuthStore.setState({ isAuthenticated: false })
  })
})
