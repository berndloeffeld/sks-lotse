import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { LandingPage } from './LandingPage'

describe('LandingPage', () => {
  it('renders the headline, the header brand link, and links to /login', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Sicher durch die SKS-Theorieprüfung' })).toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'SKS Lotse – Startseite' })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/login')

    const ctaLinks = screen.getAllByRole('link', { name: 'Jetzt kostenlos anmelden' })
    expect(ctaLinks).toHaveLength(2)
    for (const link of ctaLinks) {
      expect(link).toHaveAttribute('href', '/login')
    }
  })

  it('explains how the app works and the free/premium split', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: "So funktioniert's" })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Originalfragen üben' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Antworten oder sprechen' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sofort Feedback bekommen' })).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Warum SKS Lotse?' })).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Kostenlos starten' })).toBeInTheDocument()
    expect(screen.getByText('Anzeige')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'KI-Bewertung' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Werbefrei' })).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Jetzt loslegen' })).toBeInTheDocument()
  })
})
