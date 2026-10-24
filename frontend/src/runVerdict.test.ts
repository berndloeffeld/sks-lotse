import { describe, expect, it } from 'vitest'

import { chartRunResult, runVerdict } from './runVerdict'

describe('runVerdict', () => {
  it('passes from the threshold on', () => {
    expect(runVerdict(7, 7)).toEqual({ passed: true, missing: 0 })
    expect(runVerdict(9, 7)).toEqual({ passed: true, missing: 0 })
  })

  it('says how many points are missing below it', () => {
    expect(runVerdict(6, 7)).toEqual({ passed: false, missing: 1 })
    expect(runVerdict(0, 7)).toEqual({ passed: false, missing: 7 })
  })
})

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
