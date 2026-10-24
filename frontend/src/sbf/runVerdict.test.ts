import { describe, expect, it } from 'vitest'

import { runVerdict } from './runVerdict'

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
