import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { ErrorBoundary } from './ErrorBoundary'

function Broken(): never {
  throw new Error('boom')
}

function renderWithBoundary(child: React.ReactNode) {
  return render(
    <MemoryRouter>
      <ErrorBoundary>{child}</ErrorBoundary>
    </MemoryRouter>,
  )
}

describe('ErrorBoundary', () => {
  it('renders its children when nothing fails', () => {
    renderWithBoundary(<p>Alles gut</p>)

    expect(screen.getByText('Alles gut')).toBeInTheDocument()
  })

  it('shows the error page with reload and home actions when a child throws', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })

    renderWithBoundary(<Broken />)

    expect(screen.getByRole('heading', { level: 1, name: 'Da ist etwas schiefgelaufen' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zur Startseite' })).toHaveAttribute('href', '/')
    await user.click(screen.getByRole('button', { name: 'Seite neu laden' }))
    expect(reload).toHaveBeenCalled()
  })
})
