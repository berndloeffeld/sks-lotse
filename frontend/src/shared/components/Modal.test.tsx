import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Modal } from './Modal'

describe('Modal', () => {
  it('renders a labelled modal dialog outside the app container', () => {
    const { container } = render(
      <Modal label="Hilfsmittel">
        <button type="button">Schließen</button>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Hilfsmittel' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(container).not.toContainElement(dialog)
  })

  it('can be labelled by its heading', () => {
    render(
      <Modal labelledBy="title">
        <h2 id="title">AGB</h2>
      </Modal>,
    )
    expect(screen.getByRole('dialog', { name: 'AGB' })).toBeInTheDocument()
  })

  it('closes on a click on the backdrop, not inside the panel', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal label="Sheet" placement="sheet" onClose={onClose}>
        <p>Inhalt</p>
      </Modal>,
    )
    await user.click(screen.getByText('Inhalt'))
    expect(onClose).not.toHaveBeenCalled()
    await user.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('stays open on a backdrop click without onClose', async () => {
    const user = userEvent.setup()
    render(
      <Modal label="Pflicht">
        <p>Inhalt</p>
      </Modal>,
    )
    await user.click(screen.getByTestId('modal-backdrop'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
