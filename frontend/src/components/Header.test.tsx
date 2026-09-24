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

    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/faq')
    expect(screen.getByRole('link', { name: 'Ablauf' })).toHaveAttribute('href', '/exam-process')
    expect(screen.getByRole('link', { name: 'Preise' })).toHaveAttribute('href', '/pricing')
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
