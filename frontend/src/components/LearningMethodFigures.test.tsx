import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FlashcardBoxFigure, ForgettingCurveFigure, GradeEffectFigure } from './LearningMethodFigures'

describe('LearningMethodFigures', () => {
  it.each([
    [ForgettingCurveFigure, 'Vergessenskurve ohne und mit Wiederholung', /wachsenden Abständen/],
    [FlashcardBoxFigure, 'Die klassische Lernkartei mit drei Fächern', /zurück ins erste/],
    [GradeEffectFigure, 'Wie die Bewertung die Vergessenskurve verändert', /Halbwertszeit wird länger/],
  ])('describes %o as an image with a title, a description and a caption', (Figure, title, description) => {
    render(<Figure />)

    const image = screen.getByRole('img', { name: title })
    expect(image).toHaveAccessibleDescription(description)
    expect(screen.getByRole('figure')).toContainElement(image)
    expect(screen.getByRole('figure').querySelector('figcaption')).not.toBeEmptyDOMElement()
  })

  it('draws every curve as a path through points, with no NaN from the maths', () => {
    const { container } = render(
      <>
        <ForgettingCurveFigure />
        <GradeEffectFigure />
      </>,
    )

    const paths = [...container.querySelectorAll('path')].map((path) => path.getAttribute('d') ?? '')
    expect(paths.length).toBeGreaterThan(10)
    for (const d of paths) expect(d).not.toMatch(/NaN|Infinity/)
    for (const circle of container.querySelectorAll('circle')) {
      expect(circle.getAttribute('cx')).not.toBe('NaN')
      expect(circle.getAttribute('cy')).not.toBe('NaN')
    }
  })

  it('puts the half-life later after "Richtig" and earlier after "Teilweise richtig" and "Falsch"', () => {
    const { container } = render(<GradeEffectFigure />)

    // Per panel the dots are: the hollow one for the curve before, the filled one for the curve after.
    const filled = [...container.querySelectorAll('circle.fill-success, circle.fill-accent, circle.fill-danger')]
    const hollow = [...container.querySelectorAll('circle.fill-surface')]
    const x = (circle: Element, left: number) => Number(circle.getAttribute('cx')) - left
    expect(filled).toHaveLength(3)
    expect(x(filled[0], 4)).toBeGreaterThan(x(hollow[0], 4))
    expect(x(filled[1], 144)).toBeLessThan(x(hollow[1], 144))
    expect(x(filled[2], 284)).toBeLessThan(x(filled[1], 144))
  })
})
