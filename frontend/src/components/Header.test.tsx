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
})
