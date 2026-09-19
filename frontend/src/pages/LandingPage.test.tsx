import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { LandingPage } from './LandingPage'

function renderLandingPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  )
}

describe('LandingPage', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })
  })

  it('sends logged-in visitors into the app instead of showing the sign-up form', () => {
    useAuthStore.setState({ user: null, isAuthenticated: true, isLoading: false })
    renderLandingPage()

    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('link', { name: 'SKS Lotse – Startseite' })).toHaveAttribute('href', '/start')
    expect(within(banner).queryByRole('link', { name: 'Anmelden' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Jetzt loslegen' })).toHaveAttribute('href', '/start')
    expect(screen.getByRole('link', { name: 'Zur Übersicht' })).toHaveAttribute('href', '/start')
    expect(screen.queryByLabelText('E-Mail-Adresse')).not.toBeInTheDocument()
  })

  it('renders the headline, the header brand link, and the sign-up entry points', () => {
    renderLandingPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Sicher durch die SKS-Theorie' })).toBeInTheDocument()
    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('link', { name: 'SKS Lotse – Startseite' })).toHaveAttribute('href', '/')
    expect(within(banner).getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/login')

    expect(screen.getByRole('link', { name: 'Jetzt loslegen' })).toHaveAttribute('href', '#anmelden')
    expect(screen.getByRole('heading', { name: 'Jetzt loslegen' })).toBeInTheDocument()
    expect(screen.getByLabelText('E-Mail-Adresse')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Code anfordern' })).toBeInTheDocument()
  })

  it('explains how the app works and the free/premium split', () => {
    renderLandingPage()

    expect(screen.getByRole('heading', { name: "So funktioniert's" })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Originalfragen üben' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Antworten oder sprechen' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sofort Feedback bekommen' })).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Warum SKS Lotse?' })).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Kostenlos starten' })).toBeInTheDocument()
    expect(screen.getByText('Anzeige')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'KI-Bewertung' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Werbefrei' })).toBeInTheDocument()
  })
})
