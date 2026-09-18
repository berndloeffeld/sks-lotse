import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { PrivacyPage } from './PrivacyPage'

describe('PrivacyPage', () => {
  it('renders the data-processing sections', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Datenschutzerklärung', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Webanalyse' })).toBeInTheDocument()
    expect(screen.getByText(/Umami/)).toBeInTheDocument()
  })
})
