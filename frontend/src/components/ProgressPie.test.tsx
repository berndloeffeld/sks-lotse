import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProgressPie } from './ProgressPie'

function stopOffsets(container: HTMLElement) {
  return Array.from(container.querySelectorAll('radialGradient')).map((g) =>
    Array.from(g.querySelectorAll('stop')).map((s) => s.getAttribute('offset')),
  )
}

describe('ProgressPie', () => {
  it('lists each category with learned/total and percentage', () => {
    render(
      <ProgressPie
        slices={[
          { key: 'a', label: 'Navigation', learned: 5, total: 10 },
          { key: 'b', label: 'Wetterkunde', learned: 0, total: 30 },
        ]}
      />,
    )

    expect(screen.getByText('5 / 10 · 50%')).toBeInTheDocument()
    expect(screen.getByText('0 / 30 · 0%')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Lernstand nach Kategorie' })).toBeInTheDocument()
    expect(document.querySelectorAll('path')).toHaveLength(2)
  })

  it('moves the strong-color boundary outward with the learned share', () => {
    const { container } = render(
      <ProgressPie
        slices={[
          { key: 'a', label: 'A', learned: 0, total: 10 },
          { key: 'b', label: 'B', learned: 5, total: 10 },
          { key: 'c', label: 'C', learned: 10, total: 10 },
        ]}
      />,
    )

    const offsets = stopOffsets(container)
    expect(offsets[0][1]).toBe('0')
    expect(offsets[1][1]).toBe('0.5')
    expect(offsets[2][1]).toBe('1')
  })

  it('draws a full circle for a single category', () => {
    const { container } = render(<ProgressPie slices={[{ key: 'a', label: 'A', learned: 1, total: 4 }]} />)

    expect(container.querySelector('path')?.getAttribute('d')).toContain('a104 104')
  })

  it('renders nothing when there are no questions', () => {
    const { container } = render(<ProgressPie slices={[{ key: 'a', label: 'A', learned: 0, total: 0 }]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
