import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OfficialAnswer } from './OfficialAnswer'

const IMAGE = { src: 'a.png', width: 300, height: 200 }

describe('OfficialAnswer', () => {
  it('shows the answer text', () => {
    render(<OfficialAnswer text="Das ist die Antwort." images={[]} />)

    expect(screen.getByText('Das ist die Antwort.')).toBeInTheDocument()
  })

  it('shows the images of a sketch answer without an explanation', () => {
    render(<OfficialAnswer text="" images={[IMAGE]} />)

    expect(screen.getByRole('img', { name: 'Abbildung zur amtlichen Antwort' })).toBeInTheDocument()
    expect(screen.queryByText(/besteht nur aus einer Skizze/)).not.toBeInTheDocument()
  })

  it('says so when a sketch-only answer has neither text nor image', () => {
    render(<OfficialAnswer text={null} images={[]} />)

    expect(screen.getByText(/besteht nur aus einer Skizze/)).toBeInTheDocument()
  })
})
