import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { CatalogDerivation, DerivationText } from './Derivation'

describe('CatalogDerivation', () => {
  it('shows nothing for a question without a derivation', () => {
    const { container } = render(<CatalogDerivation blocks={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('is marked as not official and stays shut until opened (ADR-0065)', async () => {
    render(<CatalogDerivation blocks={[{ text: 'Die **Reibung am Boden** bremst den Wind.' }]} headingLevel={2} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Herleitung · nicht amtlich' })).toBeInTheDocument()
    expect(screen.getByText(/Maßgeblich ist die amtliche Antwort\./)).toBeInTheDocument()
    expect(screen.getByRole('group')).not.toHaveAttribute('open')

    await userEvent.click(screen.getByText('Herleitung anzeigen'))
    expect(screen.getByRole('group')).toHaveAttribute('open')
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
