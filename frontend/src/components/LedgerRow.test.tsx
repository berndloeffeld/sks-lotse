import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { LedgerRow } from './LedgerRow'

describe('LedgerRow', () => {
  it('renders the topic title and learned/total count', () => {
    render(<LedgerRow title="Ankern" learned={2} total={7} />)

    expect(screen.getByText('Ankern')).toBeInTheDocument()
    expect(screen.getByText('2 von 7 Fragen gelernt')).toBeInTheDocument()
  })

  it('renders "Lernen starten" as disabled without a target', () => {
    render(<LedgerRow title="Ankern" learned={0} total={7} />)

    expect(screen.getByRole('button', { name: 'Lernen starten' })).toBeDisabled()
  })

  it('renders "Lernen starten" as disabled for a topic without questions', () => {
    render(<LedgerRow title="Ankern" learned={0} total={0} to="/learn/navigation/ankern" />)

    expect(screen.getByRole('button', { name: 'Lernen starten' })).toBeDisabled()
  })

  it('links "Lernen starten" to the topic', () => {
    render(
      <MemoryRouter>
        <LedgerRow title="Ankern" learned={0} total={7} to="/learn/navigation/ankern" />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Lernen starten' })).toHaveAttribute('href', '/learn/navigation/ankern')
  })
})
