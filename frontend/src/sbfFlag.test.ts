import { describe, expect, it } from 'vitest'

import { parseSbfFlag } from './sbfFlag'

describe('parseSbfFlag', () => {
  it('takes the two values and reads unset as off', () => {
    expect(parseSbfFlag('off')).toBe('off')
    expect(parseSbfFlag('on')).toBe('on')
    expect(parseSbfFlag(undefined)).toBe('off')
    expect(parseSbfFlag('')).toBe('off')
  })

  it('rejects anything else instead of falling back', () => {
    expect(() => parseSbfFlag('ON')).toThrow('VITE_SBF must be one of off, on — got "ON"')
    expect(() => parseSbfFlag('admins')).toThrow('got "admins"')
  })
})
