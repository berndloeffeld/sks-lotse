import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OfficialAnswerBox, OwnAnswer } from './AnswerBox'

describe('OwnAnswer', () => {
  it("shows the learner's answer under an h3 by default", () => {
    render(<OwnAnswer text={'Kompass\nund Karte'} />)

    expect(screen.getByRole('heading', { level: 3, name: 'Deine Antwort' })).toBeInTheDocument()
    expect(screen.getByText(/Kompass/)).toHaveTextContent('Kompass und Karte')
  })

  it.each([null, undefined, '', '  \n'])('says "Nicht beantwortet." for an empty answer (%j)', (text) => {
    render(<OwnAnswer text={text} />)

    expect(screen.getByText('Nicht beantwortet.')).toBeInTheDocument()
  })

  it('takes the heading level of the page', () => {
    render(<OwnAnswer text="Kompass" headingLevel={2} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Deine Antwort' })).toBeInTheDocument()
  })
})

describe('OfficialAnswerBox', () => {
  it('shows the official answer in the official box', () => {
    render(<OfficialAnswerBox text="Global Positioning System" images={[]} />)

    const heading = screen.getByRole('heading', { level: 3, name: 'Amtliche Antwort' })
    expect(heading.closest('section')).toHaveClass('border-primary', 'bg-surface-alt')
    expect(screen.getByText('Global Positioning System')).toBeInTheDocument()
  })
})
