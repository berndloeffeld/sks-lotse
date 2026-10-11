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
    expect(screen.getByRole('link', { name: 'AGB' })).toHaveAttribute('href', '/terms')
  })

  it('marks the legal page the visitor is on', () => {
    render(
      <MemoryRouter initialEntries={['/privacy']}>
        <LegalFooter />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Datenschutz' })).toHaveClass('border-surface')
    expect(screen.getByRole('link', { name: 'Impressum' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Impressum' })).toHaveClass('border-transparent')
  })

  it('carries Prüfungsablauf and FAQ, but leaves Preise to the header', () => {
    render(
      <MemoryRouter>
        <LegalFooter />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Prüfungsablauf' })).toHaveAttribute('href', '/exam-process')
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/faq')
    expect(screen.queryByRole('link', { name: 'Preise' })).not.toBeInTheDocument()
  })

  it('offers a contact mail link', () => {
    render(
      <MemoryRouter>
        <LegalFooter />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Kontakt' })).toHaveAttribute(
      'href',
      'mailto:kontakt@sks-lotse.de?subject=Feedback%20SKS%20Lotse',
    )
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
