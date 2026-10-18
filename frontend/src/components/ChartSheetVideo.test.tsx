import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ChartSheetVideo } from './ChartSheetVideo'

describe('ChartSheetVideo', () => {
  it("links the sheet's video and the channel, opening a new tab", () => {
    render(<ChartSheetVideo number={1} />)
    const video = screen.getByRole('link', { name: 'Video-Anleitung auf YouTube' })
    expect(video).toHaveAttribute('href', 'https://www.youtube.com/watch?v=HaHfmZLW198')
    expect(video).toHaveAttribute('target', '_blank')
    expect(video).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('link', { name: 'McFly439' })).toHaveAttribute(
      'href',
      'https://www.youtube.com/@LauraMcFly439',
    )
  })

  it('shows nothing for a sheet without a video', () => {
    const { container } = render(<ChartSheetVideo number={99} />)
    expect(container).toBeEmptyDOMElement()
  })
})
