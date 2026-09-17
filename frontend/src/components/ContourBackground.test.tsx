import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ContourBackground } from './ContourBackground'

describe('ContourBackground', () => {
  it('renders as a decorative, non-focusable graphic', () => {
    const { container } = render(<ContourBackground />)
    const svg = container.querySelector('svg')

    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })
})
