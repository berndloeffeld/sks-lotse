import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ExamVariantSelector } from './ExamVariantSelector'

function radios() {
  return screen.getAllByRole('radio') as HTMLInputElement[]
}

describe('ExamVariantSelector', () => {
  it('marks the current value as checked', () => {
    render(<ExamVariantSelector value="motor" onChange={vi.fn()} />)

    const [segelnUndMotor, motor] = radios()
    expect(segelnUndMotor.value).toBe('segeln_und_motor')
    expect(segelnUndMotor).not.toBeChecked()
    expect(motor.value).toBe('motor')
    expect(motor).toBeChecked()
  })

  it('renders nothing checked when no variant is set yet', () => {
    render(<ExamVariantSelector value={null} onChange={vi.fn()} />)

    for (const radio of radios()) {
      expect(radio).not.toBeChecked()
    }
  })

  it('calls onChange with the picked variant', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ExamVariantSelector value={null} onChange={onChange} />)

    const [, motor] = radios()
    await user.click(motor)

    expect(onChange).toHaveBeenCalledWith('motor')
  })

  it('disables both options while saving', () => {
    render(<ExamVariantSelector value="motor" onChange={vi.fn()} disabled />)

    for (const radio of radios()) {
      expect(radio).toBeDisabled()
    }
  })
})
