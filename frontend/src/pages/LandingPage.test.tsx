import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
    expect(within(banner).getByRole('link', { name: 'SKS Lotse – Startseite' })).toHaveAttribute('href', '/learn')
    expect(within(banner).queryByRole('link', { name: 'Anmelden' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Jetzt loslegen' })).toHaveAttribute('href', '/learn')
    expect(screen.getByRole('link', { name: 'Zum Lernen' })).toHaveAttribute('href', '/learn')
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
    expect(screen.getByRole('heading', { name: 'Mit der amtlichen Antwort vergleichen' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Selbst bewerten' })).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Warum SKS Lotse?' })).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Kostenlos starten' })).toBeInTheDocument()
    expect(screen.queryByText('Anzeige')).not.toBeInTheDocument()
  })

  it('leads guests to the topics open without a login', () => {
    renderLandingPage()

    expect(screen.getByRole('link', { name: 'Oder gleich ohne Anmeldung die Fragen üben' })).toHaveAttribute(
      'href',
      '/learn',
    )
    expect(screen.getByRole('link', { name: 'Alle Fragen nach Themen, frei zum Üben' })).toHaveAttribute(
      'href',
      '/learn',
    )
    expect(screen.getByText('alle Fragen frei üben, ohne Lernstand')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kann ich auch ohne Anmeldung lernen?' })).toBeInTheDocument()
  })

  it('previews the Kartenaufgaben with a screenshot, without linking to them', () => {
    vi.stubEnv('VITE_CHART_EXERCISES', 'admins')
    const { container } = renderLandingPage()

    const preview = screen.getByRole('region', { name: 'Kartenaufgaben' })
    expect(within(preview).getByText('Vorschau · bald verfügbar')).toBeInTheDocument()
    expect(within(preview).getByRole('heading', { name: 'Lösung mit Herleitung' })).toBeInTheDocument()
    expect(within(preview).queryAllByRole('link')).toEqual([])
    expect(within(preview).getByRole('img', { name: /Kartenaufgabe 1, Aufgabe 1 von 18/ })).toHaveAttribute(
      'src',
      '/screenshots/kartenaufgabe.png',
    )
    expect(container.querySelector('a[href^="/charts"]')).toBeNull()
  })

  it('links the Kartenaufgaben once they are open to guests', () => {
    vi.stubEnv('VITE_CHART_EXERCISES', 'on')
    renderLandingPage()

    const preview = screen.getByRole('region', { name: 'Kartenaufgaben' })
    expect(within(preview).getByText('Neu')).toBeInTheDocument()
    expect(within(preview).getByRole('link', { name: /Kartenaufgaben ausprobieren/ })).toHaveAttribute(
      'href',
      '/charts',
    )
  })

  it('links to the exam process overview page', () => {
    renderLandingPage()

    expect(screen.getByRole('link', { name: 'So läuft die SKS-Prüfung ab' })).toHaveAttribute('href', '/exam-process')
  })

  it('offers share buttons after the "Kostenlos starten" pitch', () => {
    renderLandingPage()

    expect(screen.getByRole('link', { name: 'Auf WhatsApp teilen' })).toBeInTheDocument()
  })

  it('shows no beta or speech-input notice', () => {
    renderLandingPage()

    expect(screen.queryByText(/Beta/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Spracheingabe|sprich/)).not.toBeInTheDocument()
  })

  it('shows screenshots of the app, each with a description', () => {
    renderLandingPage()

    expect(screen.getByRole('heading', { name: 'Ein Blick in die App' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Probeprüfung' })).toBeInTheDocument()
    const images = screen.getAllByRole('img', { name: /^Screenshot:/ })
    // 4 learning, 3 Probeprüfung, 1 Kartenaufgaben preview.
    expect(images).toHaveLength(8)
    for (const image of images) {
      expect(image).toHaveAttribute('src', expect.stringMatching(/^\/screenshots\/.+\.png$/))
      expect(image).toHaveAttribute('width')
      expect(image).toHaveAttribute('height')
    }
  })
})
