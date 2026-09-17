import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AdSlot } from './AdSlot'

describe('AdSlot', () => {
  it('renders the placeholder label', () => {
    render(<AdSlot />)

    expect(screen.getByText('Anzeige')).toBeInTheDocument()
  })
})
