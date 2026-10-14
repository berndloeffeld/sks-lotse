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
    expect(screen.getByRole('heading', { name: /Was ist die Probeprüfung/, level: 2 })).toBeInTheDocument()
  })

  it('describes the Probeprüfung rule of ADR-0061: all grades count unless the learner opts out', () => {
    render(
      <MemoryRouter>
        <FaqPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/auch „Teilweise richtig“ und „Falsch“/)).toBeInTheDocument()
    expect(screen.getByText(/Häkchen vor dem Start/)).toBeInTheDocument()
    expect(screen.queryByText(/in der Probeprüfung richtig beantwortet hast/)).not.toBeInTheDocument()
  })
})
