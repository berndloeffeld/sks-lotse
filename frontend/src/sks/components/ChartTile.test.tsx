import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ChartTile } from './ChartTile'

describe('ChartTile', () => {
  it('renders the title and description', () => {
    render(<ChartTile title="Lernen" description="Demnächst verfügbar" />)

    expect(screen.getByRole('heading', { name: 'Lernen' })).toBeInTheDocument()
    expect(screen.getByText('Demnächst verfügbar')).toBeInTheDocument()
  })

  it('renders without a description', () => {
    render(<ChartTile title="Lernen" />)

    expect(screen.getByRole('heading', { name: 'Lernen' })).toBeInTheDocument()
  })

  it('renders an icon when given one', () => {
    render(<ChartTile title="Lernen" icon={<svg data-testid="icon" />} />)

    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })
})

describe('ChartTile label and footer', () => {
  it('renders a label above the title and a footer below the description', () => {
    render(
      <ChartTile
        title="Cuxhaven → Büsum"
        label="Kartenaufgabe 1"
        description="Elbabwärts"
        footer={<span>18 Aufgaben</span>}
      />,
    )

    expect(screen.getByText('Kartenaufgabe 1')).toBeInTheDocument()
    expect(screen.getByText('18 Aufgaben')).toBeInTheDocument()
  })
})

describe('ChartTile badge', () => {
  it('renders a badge when given one', () => {
    render(<ChartTile title="Prüfung" badge="Demnächst verfügbar" size="lg" />)

    expect(screen.getByText('Demnächst verfügbar')).toBeInTheDocument()
  })
})
