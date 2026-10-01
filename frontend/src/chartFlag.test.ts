import { describe, expect, it } from 'vitest'

import { parseChartFlag } from './chartFlag'

describe('parseChartFlag', () => {
  it('takes the three values and reads unset as off', () => {
    expect(parseChartFlag('off')).toBe('off')
    expect(parseChartFlag('admins')).toBe('admins')
    expect(parseChartFlag('on')).toBe('on')
    expect(parseChartFlag(undefined)).toBe('off')
    expect(parseChartFlag('')).toBe('off')
  })

  it('rejects anything else instead of falling back', () => {
    expect(() => parseChartFlag('ON')).toThrow('VITE_CHART_EXERCISES must be one of off, admins, on — got "ON"')
    expect(() => parseChartFlag('yes')).toThrow('got "yes"')
  })
})
