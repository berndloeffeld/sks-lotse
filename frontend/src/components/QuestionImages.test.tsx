import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { QuestionImages } from './QuestionImages'

describe('QuestionImages', () => {
  it('renders nothing without images', () => {
    const { container } = render(<QuestionImages images={[]} part="question" />)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows a single image from /catalog/ at twice its pixel size', () => {
    render(<QuestionImages images={[{ src: 'schifffahrtsrecht-22-1.png', width: 64, height: 49 }]} part="question" />)

    const image = screen.getByRole('img', { name: 'Abbildung zur Frage' })
    expect(image).toHaveAttribute('src', '/catalog/schifffahrtsrecht-22-1.png')
    expect(image).toHaveAttribute('width', '128')
    expect(image).toHaveAttribute('height', '98')
  })

  it('shows a large image at its natural size', () => {
    render(<QuestionImages images={[{ src: 'wetterkunde-33-1.png', width: 264, height: 238 }]} part="question" />)

    const image = screen.getByRole('img')
    expect(image).toHaveAttribute('width', '264')
    expect(image).toHaveAttribute('height', '238')
  })

  it('numbers several images and labels answer images as such', () => {
    render(
      <QuestionImages
        images={[
          { src: 'a-1.png', width: 10, height: 10 },
          { src: 'a-2.png', width: 10, height: 10 },
        ]}
        part="answer"
      />,
    )

    expect(screen.getByRole('img', { name: 'Abbildung zur amtlichen Antwort 1 von 2' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Abbildung zur amtlichen Antwort 2 von 2' })).toBeInTheDocument()
  })
})
