import { describe, expect, it } from 'vitest'

import { parseSbfAccountsFlag, parseSbfFlag } from './sbfFlag'

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

describe('parseSbfAccountsFlag', () => {
  it('takes the two values and reads unset as off', () => {
    expect(parseSbfAccountsFlag('off')).toBe('off')
    expect(parseSbfAccountsFlag('on')).toBe('on')
    expect(parseSbfAccountsFlag(undefined)).toBe('off')
    expect(parseSbfAccountsFlag('')).toBe('off')
  })

  it('rejects anything else, naming its own variable', () => {
    expect(() => parseSbfAccountsFlag('yes')).toThrow('VITE_SBF_ACCOUNTS must be one of off, on — got "yes"')
  })
})
