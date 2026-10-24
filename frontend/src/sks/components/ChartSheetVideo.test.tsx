import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import charts from '../data/chart_exercises.gen.json'
import { ChartSheetVideo, ChartTaskVideo } from './ChartSheetVideo'

describe('ChartSheetVideo', () => {
  // The FAQ promises a video for every sheet ("Zu jedem Bogen …"): a sheet in the app without one,
  // or without chapter marks up to its last task, fails here.
  it.each(charts.sheets.map((sheet) => [sheet.number, sheet.tasks.length]))(
    'has a video for sheet %i, marked up to its last task %i',
    (sheet, lastTask) => {
      render(<ChartSheetVideo number={sheet} />)
      expect(screen.getByRole('link', { name: 'Video-Anleitung auf YouTube' })).toBeInTheDocument()
      render(
        <ChartTaskVideo sheet={sheet} task={lastTask} className="">
          Video
        </ChartTaskVideo>,
      )
      expect(screen.getByRole('link', { name: 'Video' }).getAttribute('href')).toMatch(/&t=\d+s$/)
    },
  )

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

  it("during a run, starts the video at the current task's chapter mark", () => {
    render(
      <ChartTaskVideo sheet={1} task={2} className="">
        Video
      </ChartTaskVideo>,
    )
    expect(screen.getByRole('link', { name: 'Video' })).toHaveAttribute(
      'href',
      'https://www.youtube.com/watch?v=HaHfmZLW198&t=190s',
    )
  })

  it('starts at the beginning where a task has no chapter mark', () => {
    render(
      <ChartTaskVideo sheet={4} task={10} className="">
        Video
      </ChartTaskVideo>,
    )
    expect(screen.getByRole('link', { name: 'Video' })).toHaveAttribute(
      'href',
      'https://www.youtube.com/watch?v=S3C5MfLeOao',
    )
  })

  it('shows nothing during a run of a sheet without a video', () => {
    const { container } = render(
      <ChartTaskVideo sheet={99} task={1} className="">
        Video
      </ChartTaskVideo>,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
