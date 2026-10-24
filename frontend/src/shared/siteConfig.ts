import { parseSbfAccountsFlag, parseSbfFlag } from './sbfFlag'
import { SITES, parseSite, type Site, type SiteIdentity } from './site'

// The build's site and flags, read from the env at call time (so tests can stub them). vite.config.ts
// has already rejected unknown values; parsing again here keeps that one definition of "unset".

export function currentSite(): Site {
  return parseSite(import.meta.env.VITE_SITE)
}

export function siteIdentity(): SiteIdentity {
  return SITES[currentSite()]
}

// The footer's source line (ELWIS terms of use), once the site shows official content: SKS Lotse
// always, SBF Lotse only with its Navigationsaufgaben built.
export function catalogSourceLine(): string | null {
  return currentSite() === 'sks' || sbfNavigationOpen() ? siteIdentity().catalogSource : null
}

// The SBF Navigationsaufgaben are built for guests only in an SBF build with VITE_SBF=on.
export function sbfNavigationOpen(): boolean {
  return currentSite() === 'sbf' && parseSbfFlag(import.meta.env.VITE_SBF) === 'on'
}

// Accounts on SBF Lotse (login, profile, buying tokens): only in an SBF build with VITE_SBF_ACCOUNTS=on.
export function sbfAccountsOpen(): boolean {
  return currentSite() === 'sbf' && parseSbfAccountsFlag(import.meta.env.VITE_SBF_ACCOUNTS) === 'on'
}
