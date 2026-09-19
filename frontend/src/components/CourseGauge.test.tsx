import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CourseGauge } from './CourseGauge'

describe('CourseGauge', () => {
  it('starts at the beginning of the course', () => {
    render(<CourseGauge progress={0} />)
    expect(screen.getByRole('img', { name: 'Noch nicht gelernt' })).toBeInTheDocument()
    expect(screen.getByTestId('course-boat')).toHaveStyle({ transform: 'translate(0px, 1px)' })
  })

  it('sails along without revealing how many steps are left', () => {
    render(<CourseGauge progress={0.5} />)
    expect(screen.getByRole('img', { name: 'Auf Kurs zu gelernt' })).toBeInTheDocument()
    expect(screen.getByTestId('course-boat')).toHaveStyle({ transform: 'translate(35px, 1px)' })
  })

  it('lies at anchor once learned', () => {
    render(<CourseGauge progress={1} />)
    expect(screen.getByRole('img', { name: 'Gelernt' })).toBeInTheDocument()
    expect(screen.getByTestId('course-boat')).toHaveClass('text-success')
    expect(screen.getByTestId('course-boat')).toHaveStyle({ transform: 'translate(78px, 1px)' })
  })
})
