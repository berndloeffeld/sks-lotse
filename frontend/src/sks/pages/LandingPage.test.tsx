import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { useAuthStore } from '../../shared/store/authStore'
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
    delete window.umami
  })

  it("counts which of its links a guest takes, the hero's sign-up as an invitation", async () => {
    const track = vi.fn()
    window.umami = { track }
    renderLandingPage()

    await userEvent.click(screen.getByRole('link', { name: 'Kostenloses Konto anlegen' }))
    expect(track).toHaveBeenLastCalledWith('signup_cta_clicked', { place: 'landing_hero' })

    for (const [name, target] of [
      ['Oder gleich ohne Anmeldung alle Fragen üben', 'hero_guest'],
      ['Alle Fragen nach Themen, frei zum Üben', 'catalog_learn'],
      ['Lernen wie mit Karteikarten: die Lernmethode', 'learning_method'],
      ['Mehr zum Fragenkatalog in den häufigen Fragen', 'faq'],
      ['So läuft die SKS-Prüfung ab', 'exam_process'],
      ['Kann ich auch ohne Anmeldung lernen?', 'faq_entry'],
      ['Alle Fragen ansehen →', 'faq_all'],
    ]) {
      await userEvent.click(screen.getByRole('link', { name }))
      expect(track).toHaveBeenLastCalledWith('landing_link_clicked', { target })
    }
    // "Preise" in the pitch, not the header's.
    await userEvent.click(within(screen.getByText(/Der Lotsen-Check läuft über Tokens/)).getByRole('link'))
    expect(track).toHaveBeenLastCalledWith('landing_link_clicked', { target: 'pricing' })
  })

  it('counts nothing for a logged-in visitor', async () => {
    const track = vi.fn()
    window.umami = { track }
    useAuthStore.setState({ user: null, isAuthenticated: true, isLoading: false })
    renderLandingPage()

    await userEvent.click(screen.getByRole('link', { name: 'Alle Fragen ansehen →' }))
    expect(track).not.toHaveBeenCalled()
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
    expect(screen.queryByText(/Tokens für KI-gestützte Auswertungen/)).not.toBeInTheDocument()
  })

  it('renders the headline, the header brand link, and the sign-up entry points', () => {
    renderLandingPage()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Lerne die SKS-Theorie, bis du sie wirklich kannst' }),
    ).toBeInTheDocument()
    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('link', { name: 'SKS Lotse – Startseite' })).toHaveAttribute('href', '/')
    expect(within(banner).getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/login')

    expect(screen.getByRole('link', { name: 'Kostenloses Konto anlegen' })).toHaveAttribute('href', '#anmelden')
    expect(screen.getByRole('heading', { name: 'Jetzt loslegen' })).toBeInTheDocument()
    expect(screen.getByLabelText('E-Mail-Adresse')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Code anfordern' })).toBeInTheDocument()
    // The signup bonus, under the hero button only (the form is for returning learners too).
    expect(screen.getByText(/Auswertungen geschenkt$/)).toHaveTextContent('Mit Anmeldung 10 Tokens')
    expect(screen.queryByText(/Jetzt anmelden und/)).not.toBeInTheDocument()
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

    expect(screen.getByRole('link', { name: 'Oder gleich ohne Anmeldung alle Fragen üben' })).toHaveAttribute(
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
    // What a run keeps at hand (ChartTools); the sheet's rules are read before the start, not in it.
    expect(within(preview).getByText(/Originaltext der Aufgabe und deine bisherigen Antworten/)).toBeInTheDocument()
    expect(within(preview).queryByText(/Regeln des Bogens/)).not.toBeInTheDocument()
    expect(within(preview).queryAllByRole('link')).toEqual([])
    expect(within(preview).getByRole('img', { name: /Kartenaufgabe 1, Aufgabe 1 von 18/ })).toHaveAttribute(
      'src',
      '/screenshots/kartenaufgabe.png',
    )
    expect(container.querySelector('a[href^="/charts"]')).toBeNull()
  })

  it('links the Kartenaufgaben once they are open to guests', async () => {
    vi.stubEnv('VITE_CHART_EXERCISES', 'on')
    renderLandingPage()

    const preview = screen.getByRole('region', { name: 'Kartenaufgaben' })
    expect(within(preview).getByText('Neu')).toBeInTheDocument()
    const link = within(preview).getByRole('link', { name: /Kartenaufgaben ausprobieren/ })
    expect(link).toHaveAttribute('href', '/charts')
    const track = vi.fn()
    window.umami = { track }
    await userEvent.click(link)
    expect(track).toHaveBeenCalledExactlyOnceWith('landing_link_clicked', { target: 'charts' })
  })

  it('links to the exam process overview page', () => {
    renderLandingPage()

    expect(screen.getByRole('link', { name: 'So läuft die SKS-Prüfung ab' })).toHaveAttribute('href', '/exam-process')
  })

  it('links to the learning method page', () => {
    renderLandingPage()

    expect(screen.getByRole('link', { name: 'Lernen wie mit Karteikarten: die Lernmethode' })).toHaveAttribute(
      'href',
      '/learning-method',
    )
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
