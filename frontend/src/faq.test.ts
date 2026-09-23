import { describe, expect, it } from 'vitest'

import { FAQ } from './faq'

describe('FAQ', () => {
  it('gives every entry a non-empty question, answer, and unique id', () => {
    const ids = FAQ.map((entry) => entry.id)

    expect(ids).toHaveLength(new Set(ids).size)
    for (const { id, question, answer } of FAQ) {
      expect(id).toMatch(/^[a-z-]+$/)
      expect(question.length).toBeGreaterThan(0)
      expect(answer.length).toBeGreaterThan(0)
    }
  })
})
