import { describe, expect, it } from 'vitest'

import { percentOf } from './format'

describe('percentOf', () => {
  it('rounds to a whole percentage', () => {
    expect(percentOf(1, 3)).toBe(33)
    expect(percentOf(2, 3)).toBe(67)
  })

  it('is 0 for an empty total', () => {
    expect(percentOf(0, 0)).toBe(0)
  })
})
