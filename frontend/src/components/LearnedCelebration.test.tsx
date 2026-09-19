import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LearnedCelebration } from './LearnedCelebration'

describe('LearnedCelebration', () => {
  it('shows the banner with the question number', () => {
    render(<LearnedCelebration questionNumber={42} />)

    expect(screen.getByTestId('learned-celebration')).toHaveTextContent('Gelernt!')
    expect(screen.getByTestId('learned-celebration')).toHaveTextContent('Nr. 42')
  })
})
