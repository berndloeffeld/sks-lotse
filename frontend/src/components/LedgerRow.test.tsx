import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LedgerRow } from './LedgerRow'

describe('LedgerRow', () => {
  it('renders the topic title and learned/total count', () => {
    render(<LedgerRow title="Ankern" learned={2} total={7} />)

    expect(screen.getByText('Ankern')).toBeInTheDocument()
    expect(screen.getByText('2 von 7 Fragen gelernt')).toBeInTheDocument()
  })

  it('renders "Lernen starten" as disabled', () => {
    render(<LedgerRow title="Ankern" learned={0} total={7} />)

    expect(screen.getByRole('button', { name: 'Lernen starten' })).toBeDisabled()
  })
})
