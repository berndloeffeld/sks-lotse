import { describe, expect, it } from 'vitest'

import { chartRunResult } from './chartVerdict'

describe('chartRunResult', () => {
  it('follows the Richtlinien: from 20 passed, 17 to 19 oral, below failed', () => {
    expect(chartRunResult(30)).toBe('bestanden')
    expect(chartRunResult(20)).toBe('bestanden')
    expect(chartRunResult(19)).toBe('muendliche_nachpruefung')
    expect(chartRunResult(17)).toBe('muendliche_nachpruefung')
    expect(chartRunResult(16)).toBe('nicht_bestanden')
    expect(chartRunResult(0)).toBe('nicht_bestanden')
  })
})
