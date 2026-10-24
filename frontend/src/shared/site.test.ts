import { describe, expect, it } from 'vitest'

import { SITES, parseSite } from './site'

describe('parseSite', () => {
  it('takes the two sites and reads unset as SKS Lotse', () => {
    expect(parseSite('sks')).toBe('sks')
    expect(parseSite('sbf')).toBe('sbf')
    expect(parseSite(undefined)).toBe('sks')
    expect(parseSite('')).toBe('sks')
  })

  it('rejects anything else instead of falling back', () => {
    expect(() => parseSite('SBF')).toThrow('VITE_SITE must be one of sks, sbf — got "SBF"')
    expect(() => parseSite('binnen')).toThrow('got "binnen"')
  })
})

describe('SITES', () => {
  it('gives each site its brand and its own domain', () => {
    expect(SITES.sks).toMatchObject({ name: 'SKS Lotse', origin: 'https://sks-lotse.de' })
    expect(SITES.sbf).toMatchObject({ name: 'SBF Lotse', origin: 'https://sbf-lotse.de' })
  })

  it('links the SKS content pages only from SKS Lotse, the shared AGB from both (ADR-0070)', () => {
    const paths = (site: keyof typeof SITES) => SITES[site].footerLinks.map((link) => link.to)
    expect(paths('sks')).toEqual(['/exam-process', '/learning-method', '/faq', '/imprint', '/privacy', '/terms'])
    expect(paths('sbf')).toEqual(['/faq', '/imprint', '/privacy', '/terms'])
  })
})
