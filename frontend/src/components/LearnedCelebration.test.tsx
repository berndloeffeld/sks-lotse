import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LearnedCelebration } from './LearnedCelebration'

describe('LearnedCelebration', () => {
  it('shows the banner explaining the question is paused for a while', () => {
    render(<LearnedCelebration />)

    expect(screen.getByTestId('learned-celebration')).toHaveTextContent('Gelernt!')
    expect(screen.getByTestId('learned-celebration')).toHaveTextContent(
      'Diese Frage taucht jetzt eine Weile nicht mehr auf.',
    )
  })
})
