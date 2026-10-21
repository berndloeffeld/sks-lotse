import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { DerivationDetails, DerivationText } from './Derivation'

describe('DerivationDetails', () => {
  it('shows nothing when there is no derivation', () => {
    const { container } = render(<DerivationDetails blocks={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('stays shut until opened, then shows its note and the steps', async () => {
    render(<DerivationDetails blocks={[{ text: 'Die **Reibung am Boden** bremst den Wind.' }]} note="Nicht amtlich." />)

    expect(screen.getByRole('group')).not.toHaveAttribute('open')
    await userEvent.click(screen.getByText('Herleitung anzeigen'))
    expect(screen.getByRole('group')).toHaveAttribute('open')
    expect(screen.getByText('Nicht amtlich.')).toBeInTheDocument()
    expect(screen.getByText('Reibung am Boden').tagName).toBe('STRONG')
  })
})

describe('DerivationText', () => {
  it('renders a table with its sum rule', () => {
    render(
      <DerivationText
        blocks={[
          {
            table: [
              { cells: ['a', '1'], sum: false },
              { cells: ['Summe', '**2**'], sum: true, sum_until: 1 },
            ],
          },
        ]}
      />,
    )
    const cells = screen.getAllByRole('cell')
    expect(cells.map((c) => c.textContent)).toEqual(['a', '1', 'Summe', '2'])
    expect(cells[2]).toHaveClass('border-t')
    expect(cells[3]).not.toHaveClass('border-t')
  })
})
