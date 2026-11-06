import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Logo, LogoMark } from './Logo'

describe('Logo', () => {
  it('renders the brand name next to the mark', () => {
    render(<Logo />)

    expect(screen.getByText('SKS Lotse')).toBeInTheDocument()
  })

  it('applies a custom className to LogoMark', () => {
    const { container } = render(<LogoMark className="h-5 w-5" />)

    expect(container.querySelector('svg')).toHaveClass('h-5', 'w-5')
  })
})
