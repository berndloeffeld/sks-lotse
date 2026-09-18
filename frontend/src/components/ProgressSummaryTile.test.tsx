import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProgressSummaryTile } from './ProgressSummaryTile'

describe('ProgressSummaryTile', () => {
  it('shows the learned/total count and rounded percentage', () => {
    render(<ProgressSummaryTile learned={25} total={100} />)

    expect(screen.getByText('25%')).toBeInTheDocument()
    expect(screen.getByText('25 von 100 Fragen gelernt')).toBeInTheDocument()
  })

  it('shows 0% when there are no questions yet', () => {
    render(<ProgressSummaryTile learned={0} total={0} />)

    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByText('0 von 0 Fragen gelernt')).toBeInTheDocument()
  })
})
