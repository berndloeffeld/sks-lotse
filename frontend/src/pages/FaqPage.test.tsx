import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { FaqPage } from './FaqPage'

describe('FaqPage', () => {
  it('renders the questions without requiring a login', () => {
    render(
      <MemoryRouter>
        <FaqPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Häufige Fragen', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Was ist die Prüfungssimulation/, level: 2 })).toBeInTheDocument()
  })
})
