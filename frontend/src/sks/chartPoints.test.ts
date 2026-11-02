import { describe, expect, it } from 'vitest'

import { pointsLabel } from './chartPoints'

describe('pointsLabel', () => {
  it('uses the singular for one point only', () => {
    expect(pointsLabel(0)).toBe('0 Punkte')
    expect(pointsLabel(1)).toBe('1 Punkt')
    expect(pointsLabel(3)).toBe('3 Punkte')
  })
})
