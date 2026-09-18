import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { LegalFooter } from './LegalFooter'

describe('LegalFooter', () => {
  it('links to the Impressum and Datenschutz pages', () => {
    render(
      <MemoryRouter>
        <LegalFooter />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/imprint')
    expect(screen.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', '/privacy')
  })

  it('attributes the question catalog to the WSV via ELWIS', () => {
    render(
      <MemoryRouter>
        <LegalFooter />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Wasserstraßen- und Schifffahrtsverwaltung des Bundes/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ELWIS' })).toHaveAttribute('href', 'https://www.elwis.de')
  })
})
