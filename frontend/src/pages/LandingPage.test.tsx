import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { LandingPage } from './LandingPage'

describe('LandingPage', () => {
  it('renders the headline, the header brand link, and a link to /login', () => {
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
    expect(screen.getByRole('link', { name: 'Jetzt kostenlos anmelden' })).toHaveAttribute('href', '/login')
  })
})
