import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

  it('carries Prüfungsablauf, Lernmethode and FAQ, but leaves Preise to the header', () => {
    render(
      <MemoryRouter>
        <LegalFooter />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Prüfungsablauf' })).toHaveAttribute('href', '/exam-process')
    expect(screen.getByRole('link', { name: 'Lernmethode' })).toHaveAttribute('href', '/learning-method')
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

  it('links the other site: SKS Lotse to SBF Lotse, and back', () => {
    const { unmount } = render(
      <MemoryRouter>
        <LegalFooter />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'SBF Lotse' })).toHaveAttribute('href', 'https://sbf-lotse.de')
    unmount()

    vi.stubEnv('VITE_SITE', 'sbf')
    render(
      <MemoryRouter>
        <LegalFooter />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'SKS Lotse' })).toHaveAttribute('href', 'https://sks-lotse.de')
  })
})
