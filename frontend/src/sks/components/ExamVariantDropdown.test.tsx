import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ExamVariantDropdown } from './ExamVariantDropdown'

describe('ExamVariantDropdown', () => {
  it('shows the current value as selected', () => {
    render(<ExamVariantDropdown value="motor" onChange={vi.fn()} />)

    expect(screen.getByRole('combobox')).toHaveValue('motor')
  })

  it('shows the placeholder option when no variant is set yet', () => {
    render(<ExamVariantDropdown value={null} onChange={vi.fn()} />)

    expect(screen.getByRole('combobox')).toHaveValue('')
  })

  it('calls onChange with the picked variant', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ExamVariantDropdown value={null} onChange={onChange} />)

    await user.selectOptions(screen.getByRole('combobox'), 'motor')

    expect(onChange).toHaveBeenCalledWith('motor')
  })

  it('disables the dropdown while saving', () => {
    render(<ExamVariantDropdown value="motor" onChange={vi.fn()} disabled />)

    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})
