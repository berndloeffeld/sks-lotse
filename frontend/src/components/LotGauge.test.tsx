import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LotGauge } from './LotGauge'

describe('LotGauge', () => {
  it('describes the current streak', () => {
    render(<LotGauge streak={2} />)
    expect(screen.getByRole('img', { name: '2 von 3 Mal in Folge richtig' })).toBeInTheDocument()
  })

  it('reads "Gelernt" once the streak reaches the threshold', () => {
    render(<LotGauge streak={4} />)
    expect(screen.getByRole('img', { name: 'Gelernt' })).toBeInTheDocument()
  })
})
