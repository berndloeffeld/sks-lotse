import { describe, expect, it } from 'vitest'

import { isLearned, streakProgress } from './progress'

describe('progress', () => {
  it('maps a streak to 0–1, capped at learned', () => {
    expect(streakProgress(0)).toBe(0)
    expect(streakProgress(1)).toBeCloseTo(1 / 3)
    expect(streakProgress(3)).toBe(1)
    expect(streakProgress(7)).toBe(1)
    expect(streakProgress(-1)).toBe(0)
  })

  it('knows when a question is learned', () => {
    expect(isLearned(2)).toBe(false)
    expect(isLearned(3)).toBe(true)
  })
})
