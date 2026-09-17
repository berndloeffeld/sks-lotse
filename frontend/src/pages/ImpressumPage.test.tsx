import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { ImpressumPage } from './ImpressumPage'

describe('ImpressumPage', () => {
  it('renders the Anbieter details required by § 5 DDG', () => {
    render(
      <MemoryRouter>
        <ImpressumPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Impressum', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/Bernd\.Loeffeld@web\.de/)).toBeInTheDocument()
  })
})
