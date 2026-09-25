import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { Header } from './Header'

describe('Header', () => {
  it('links the brand to / and Anmelden to /login', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'SKS Lotse – Startseite' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/login')
  })

  it('carries the content links next to Anmelden by default', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Prüfungsablauf' })).toHaveAttribute('href', '/exam-process')
    expect(screen.getByRole('link', { name: 'Preise' })).toHaveAttribute('href', '/pricing')
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/faq')
    // Same order as in the logged-in Menü.
    expect(
      screen
        .getAllByRole('link')
        .slice(1, 4)
        .map((link) => link.textContent),
    ).toEqual(['Prüfungsablauf', 'Preise', 'FAQ'])
  })

  it('marks the content page the visitor is on', () => {
    render(
      <MemoryRouter initialEntries={['/pricing']}>
        <Header />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Preise' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Preise' })).toHaveClass('border-surface')
    expect(screen.getByRole('link', { name: 'FAQ' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveClass('border-transparent')
  })

  it('renders nothing but the brand when nav is explicitly null', () => {
    render(
      <MemoryRouter>
        <Header nav={null} />
      </MemoryRouter>,
    )

    expect(screen.getAllByRole('link')).toHaveLength(1)
  })
})
