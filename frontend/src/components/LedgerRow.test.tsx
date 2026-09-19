import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { LedgerRow } from './LedgerRow'

describe('LedgerRow', () => {
  it('renders the topic title and learned/total count', () => {
    render(<LedgerRow title="Ankern" learned={2} total={7} />)

    expect(screen.getByText('Ankern')).toBeInTheDocument()
    expect(screen.getByText('2 von 7 Fragen gelernt')).toBeInTheDocument()
  })

  it('renders "Lernen starten" as disabled without a target', () => {
    render(<LedgerRow title="Ankern" learned={0} total={7} />)

    expect(screen.getByRole('button', { name: 'Lernen starten' })).toBeDisabled()
  })

  it('renders "Lernen starten" as disabled for a topic without questions', () => {
    render(<LedgerRow title="Ankern" learned={0} total={0} to="/learn/navigation/ankern" />)

    expect(screen.getByRole('button', { name: 'Lernen starten' })).toBeDisabled()
  })

  it('links "Lernen starten" to the topic', () => {
    render(
      <MemoryRouter>
        <LedgerRow title="Ankern" learned={0} total={7} to="/learn/navigation/ankern" />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Lernen starten' })).toHaveAttribute('href', '/learn/navigation/ankern')
  })

  it('shows the count of partially learned questions', () => {
    render(<LedgerRow title="Ankern" learned={2} learning={3} total={7} />)

    expect(screen.getByText('2 von 7 Fragen gelernt · 3 teilweise')).toBeInTheDocument()
  })

  it('renders no Fokus star without a toggle handler', () => {
    render(<LedgerRow title="Ankern" learned={0} total={7} />)

    expect(screen.queryByRole('button', { name: /Fokus/ })).not.toBeInTheDocument()
  })

  it.each([
    [false, 'Als Fokus markieren: Ankern', 'false'],
    [true, 'Fokus entfernen: Ankern', 'true'],
  ])('renders the Fokus star for isFocus=%s and calls the handler on click', async (isFocus, name, pressed) => {
    const onToggleFocus = vi.fn()
    render(<LedgerRow title="Ankern" learned={0} total={7} isFocus={isFocus} onToggleFocus={onToggleFocus} />)

    const star = screen.getByRole('button', { name })
    expect(star).toHaveAttribute('aria-pressed', pressed)
    await userEvent.click(star)

    expect(onToggleFocus).toHaveBeenCalledOnce()
  })

  it('marks a fully learned topic as done', () => {
    render(
      <MemoryRouter>
        <LedgerRow title="Ankern" learned={7} total={7} to="/learn/navigation/ankern" />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Wiederholen' })).toBeInTheDocument()
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('does not mark a topic without questions as done', () => {
    render(<LedgerRow title="Ankern" learned={0} total={0} />)

    expect(screen.queryByText('✓')).not.toBeInTheDocument()
  })
})
