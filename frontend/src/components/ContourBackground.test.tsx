import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ContourBackground } from './ContourBackground'

describe('ContourBackground', () => {
  it('renders as a decorative, non-focusable graphic', () => {
    const { container } = render(<ContourBackground />)
    const svg = container.querySelector('svg')

    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('draws its lines in the given stroke color', () => {
    const { container } = render(<ContourBackground stroke="red" />)

    for (const path of container.querySelectorAll('path')) {
      expect(path).toHaveAttribute('stroke', 'red')
    }
  })
})
