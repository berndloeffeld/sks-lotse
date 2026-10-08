import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ErrorMessage, StatusMessage } from './Messages'

describe('ErrorMessage', () => {
  it.each([null, undefined, false, ''])('renders nothing for %s', (empty) => {
    const { container } = render(<ErrorMessage>{empty}</ErrorMessage>)
    expect(container).toBeEmptyDOMElement()
  })

  it('announces the message, without a retry by default', () => {
    render(<ErrorMessage>Das hat nicht geklappt.</ErrorMessage>)
    expect(screen.getByRole('alert')).toHaveTextContent('Das hat nicht geklappt.')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('offers "Erneut laden", locked while the retry runs', async () => {
    const user = userEvent.setup()
    let finish = () => {}
    const onRetry = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    render(<ErrorMessage onRetry={onRetry}>Die Fragen konnten nicht geladen werden.</ErrorMessage>)

    await user.click(screen.getByRole('button', { name: 'Erneut laden' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Wird geladen…' })).toBeDisabled()

    finish()
    expect(await screen.findByRole('button', { name: 'Erneut laden' })).toBeEnabled()
  })

  it('unlocks the retry when it throws', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn().mockRejectedValue(new Error('offline'))
    render(<ErrorMessage onRetry={onRetry}>Fehler</ErrorMessage>)
    await user.click(screen.getByRole('button', { name: 'Erneut laden' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('button', { name: 'Erneut laden' })).toBeEnabled()
  })
})

describe('StatusMessage', () => {
  it('keeps an empty live region mounted', () => {
    render(<StatusMessage>{null}</StatusMessage>)
    const region = screen.getByRole('status')
    expect(region).toBeEmptyDOMElement()
    expect(region).toHaveClass('sr-only')
  })

  it('shows the confirmation in the success style by default', () => {
    render(<StatusMessage>Gespeichert.</StatusMessage>)
    expect(screen.getByRole('status')).toHaveTextContent('Gespeichert.')
    expect(screen.getByRole('status')).toHaveClass('border-success')
  })

  it('has a neutral style', () => {
    render(<StatusMessage tone="neutral">Abgebrochen.</StatusMessage>)
    expect(screen.getByRole('status')).toHaveClass('border-border')
  })
})
