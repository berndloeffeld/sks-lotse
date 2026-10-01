import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

  afterEach(() => vi.unstubAllEnvs())

  it('carries the content links next to Anmelden by default', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Lernen' })).toHaveAttribute('href', '/learn')
    expect(screen.getByRole('link', { name: 'Preise' })).toHaveAttribute('href', '/pricing')
    // Prüfungsablauf and FAQ are in the footer, which keeps the bar short.
    expect(
      screen
        .getAllByRole('link')
        .slice(1, -1)
        .map((link) => link.textContent),
    ).toEqual(['Lernen', 'Preise'])
  })

  it('leads guests to the Kartenaufgaben while they are open to them', () => {
    vi.stubEnv('VITE_CHART_EXERCISES', 'on')
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Kartenaufgaben' })).toHaveAttribute('href', '/charts')
    expect(
      screen
        .getAllByRole('link')
        .slice(1, -1)
        .map((link) => link.textContent),
    ).toEqual(['Lernen', 'Kartenaufgaben', 'Preise'])
  })

  it.each(['admins', 'off'])('has no Kartenaufgaben link for guests at %s', (flag) => {
    vi.stubEnv('VITE_CHART_EXERCISES', flag)
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('link', { name: 'Kartenaufgaben' })).not.toBeInTheDocument()
  })

  it('marks the content page the visitor is on', () => {
    render(
      <MemoryRouter initialEntries={['/pricing']}>
        <Header />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Preise' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Preise' })).toHaveClass('border-surface')
    expect(screen.getByRole('link', { name: 'Lernen' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Lernen' })).toHaveClass('border-transparent')
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
