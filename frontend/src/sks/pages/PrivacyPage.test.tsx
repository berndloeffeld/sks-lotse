import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { PrivacyPage } from './PrivacyPage'

describe('PrivacyPage', () => {
  it('renders the data-processing sections', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Datenschutzerklärung', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Webanalyse' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lernfortschritt und Profil' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Käufe (Tokens)' })).toBeInTheDocument()
    expect(screen.getByText(/Stripe Payments Europe/)).toBeInTheDocument()
    expect(screen.getByText(/Umami Cloud/)).toBeInTheDocument()
  })

  it('describes what a guest leaves behind: web analytics and the Formblatt in the browser', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )

    const guests = screen.getByText(/^Ohne Anmeldung können Sie/)
    expect(guests).toHaveTextContent('Kartenaufgaben und auf SBF Lotse die amtlichen Navigationsaufgaben bearbeiten')
    expect(guests).toHaveTextContent('zur Webanalyse')
    expect(guests).toHaveTextContent('Formblatt Gezeiten')
    expect(guests).toHaveTextContent('Formblatt leeren')
    expect(guests).not.toHaveTextContent('nur die Angaben zum Hosting')
    expect(screen.getByText(/^Funktionen, die Daten speichern/)).toHaveTextContent('setzen ein Konto voraus')
  })
})
