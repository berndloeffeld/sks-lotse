import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { LearnModeTabs, RefreshPanel } from './LearnModes'

describe('LearnModeTabs', () => {
  it('marks the active mode and reports a click', async () => {
    const onChange = vi.fn()
    render(<LearnModeTabs active="focus" onChange={onChange} />)

    expect(screen.getByRole('tab', { name: 'Fokus' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Nach Thema' })).toHaveAttribute('aria-selected', 'false')

    await userEvent.click(screen.getByRole('tab', { name: 'Auffrischen' }))
    expect(onChange).toHaveBeenCalledWith('refresh')
  })

  it('moves between the modes with the arrow keys, wrapping around', async () => {
    const onChange = vi.fn()
    render(<LearnModeTabs active="topic" onChange={onChange} />)
    const user = userEvent.setup()

    screen.getByRole('tab', { name: 'Nach Thema' }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith('refresh')

    // Focus followed to the Auffrischen tab, so the next step wraps to the first one.
    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('topic')

    await user.keyboard('a')
    expect(onChange).toHaveBeenCalledTimes(2)
  })
})

function renderPanel(summary: React.ComponentProps<typeof RefreshPanel>['summary']) {
  return render(
    <MemoryRouter>
      <RefreshPanel summary={summary} />
    </MemoryRouter>,
  )
}

describe('RefreshPanel', () => {
  it('shows the counts and links to the session when questions could have faded', () => {
    renderPanel({ lapsed: 14, expiring: 6, fresh: 8 })

    expect(
      screen.getByText('14 möglicherweise verblasst · 6 könnten bald verblassen · 8 noch frisch'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Auffrischen starten' })).toHaveAttribute('href', '/learn/refresh')
  })

  it('says nothing is fading, without a start button, when everything is still fresh', () => {
    renderPanel({ lapsed: 0, expiring: 0, fresh: 5 })

    expect(screen.queryByRole('link', { name: 'Auffrischen starten' })).not.toBeInTheDocument()
    expect(screen.getByText(/Gerade droht nichts zu verblassen/)).toBeInTheDocument()
  })

  it('explains itself before anything was learned', () => {
    renderPanel({ lapsed: 0, expiring: 0, fresh: 0 })

    expect(screen.getByText(/Sobald du Fragen sicher gelernt hast/)).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('shows only the heading while the counts load', () => {
    renderPanel(null)

    expect(screen.getByRole('heading', { name: 'Auffrischen' })).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText(/verblass/)).not.toBeInTheDocument()
  })
})
