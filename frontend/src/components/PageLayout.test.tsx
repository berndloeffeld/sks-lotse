import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { PageLayout } from './PageLayout'
import { makeUser } from '../test/fixtures'

function renderLayout(props: Partial<Parameters<typeof PageLayout>[0]> = {}, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
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

  it('shows the main nav and the phone tab bar, and links the brand to /learn by default', () => {
    useAuthStore.setState({ user: null })
    renderLayout()

    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('link', { name: 'SKS Lotse – Startseite' })).toHaveAttribute('href', '/learn')
    expect(within(banner).getByRole('link', { name: 'Lernen' })).toHaveAttribute('href', '/learn')
    expect(within(banner).getByRole('button', { name: 'Konto' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Hauptnavigation mobil' })).toBeInTheDocument()
  })

  it('leaves out the tab bar while a session runs', () => {
    useAuthStore.setState({ user: makeUser() })
    renderLayout({ immersive: true }, '/exam/1')
    expect(screen.queryByRole('navigation', { name: 'Hauptnavigation mobil' })).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeInTheDocument()
    useAuthStore.setState({ user: null })
  })

  it('shows an Anmelden link on public pages and no nav at all with nav="none"', () => {
    const { unmount } = renderLayout({ nav: 'public' })
    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('link', { name: 'SKS Lotse – Startseite' })).toHaveAttribute('href', '/')
    expect(within(banner).getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/login')
    unmount()

    renderLayout({ nav: 'none' })
    expect(within(screen.getByRole('banner')).getAllByRole('link')).toHaveLength(1)
    expect(screen.queryByRole('navigation', { name: 'Hauptnavigation mobil' })).not.toBeInTheDocument()
  })

  it('shows the account nav on public pages once logged in', () => {
    useAuthStore.setState({ user: null, isAuthenticated: true })
    renderLayout({ nav: 'public' })

    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('link', { name: 'SKS Lotse – Startseite' })).toHaveAttribute('href', '/learn')
    expect(within(banner).queryByRole('link', { name: 'Anmelden' })).not.toBeInTheDocument()
    expect(within(banner).getByRole('button', { name: 'Konto' })).toBeInTheDocument()
    useAuthStore.setState({ isAuthenticated: false })
  })
})
