import { describe, expect, it, vi } from 'vitest'

import { catalogSourceLine, currentSite, sbfNavigationOpen, siteIdentity } from './siteConfig'

describe('siteConfig', () => {
  it('is SKS Lotse unless the build says otherwise', () => {
    expect(currentSite()).toBe('sks')
    expect(siteIdentity().name).toBe('SKS Lotse')
    expect(sbfNavigationOpen()).toBe(false)
  })

  it('is SBF Lotse in the SBF build', () => {
    vi.stubEnv('VITE_SITE', 'sbf')
    expect(currentSite()).toBe('sbf')
    expect(siteIdentity().origin).toBe('https://sbf-lotse.de')
  })

  it('opens the Navigationsaufgaben only in an SBF build with VITE_SBF=on', () => {
    vi.stubEnv('VITE_SITE', 'sbf')
    expect(sbfNavigationOpen()).toBe(false)
    vi.stubEnv('VITE_SBF', 'on')
    expect(sbfNavigationOpen()).toBe(true)
    vi.stubEnv('VITE_SITE', 'sks')
    expect(sbfNavigationOpen()).toBe(false)
  })

  it('names the catalog as source once the site shows official content', () => {
    expect(catalogSourceLine()).toMatch(/amtlicher Fragenkatalog SKS$/)
    vi.stubEnv('VITE_SITE', 'sbf')
    expect(catalogSourceLine()).toBeNull()
    vi.stubEnv('VITE_SBF', 'on')
    expect(catalogSourceLine()).toMatch(/Fragenkatalog für den Sportbootführerschein See$/)
  })
})
