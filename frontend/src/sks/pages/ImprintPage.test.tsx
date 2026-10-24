import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { ImprintPage } from './ImprintPage'

describe('ImprintPage', () => {
  it('renders the Anbieter details required by § 5 DDG', () => {
    render(
      <MemoryRouter>
        <ImprintPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Impressum', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/kontakt@sks-lotse\.de/)).toBeInTheDocument()
  })
})
