import { describe, expect, it } from 'vitest'

import { formatDateTime, percentOf } from './format'

describe('percentOf', () => {
  it('rounds to a whole percentage', () => {
    expect(percentOf(1, 3)).toBe(33)
    expect(percentOf(2, 3)).toBe(67)
  })

  it('is 0 for an empty total', () => {
    expect(percentOf(0, 0)).toBe(0)
  })
})

describe('formatDateTime', () => {
  it('formats as German medium date and short time, without seconds', () => {
    // The exact digits depend on the machine's time zone; the shape doesn't.
    expect(formatDateTime('2026-09-19T12:05:00Z')).toMatch(/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/)
  })
})
