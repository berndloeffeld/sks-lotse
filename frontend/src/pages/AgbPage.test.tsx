import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { AgbPage } from './AgbPage'

describe('AgbPage', () => {
  it('renders the terms with the current version date', () => {
    render(
      <MemoryRouter>
        <AgbPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'AGB', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Stand: 24. September 2026')).toBeInTheDocument()
  })
})
