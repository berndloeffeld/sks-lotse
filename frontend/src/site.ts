// Which site a build is (ADR-0067): one codebase, two brands. VITE_SITE=sks builds SKS Lotse
// (sks-lotse.de), VITE_SITE=sbf SBF Lotse (sbf-lotse.de). Unset is "sks", so every existing setup
// keeps building SKS Lotse; a typo fails the build (vite.config.ts) instead of quietly building the
// wrong site. No import.meta here, since vite.config.ts imports this too (siteConfig.ts reads the env).

export type Site = 'sks' | 'sbf'

const VALUES: readonly string[] = ['sks', 'sbf']

export function parseSite(value: string | undefined): Site {
  if (!value) return 'sks'
  if (!VALUES.includes(value)) {
    throw new Error(`VITE_SITE must be one of sks, sbf — got "${value}"`)
  }
  return value as Site
}

export interface SiteIdentity {
  // The brand, as the wordmark, the tab titles and the footer say it.
  name: string
  // Canonical origin: the canonicals, the sitemap and the structured data are built on it.
  origin: string
  // The links in the footer, in this order, besides the contact link.
  footerLinks: readonly { to: string; label: string }[]
  // Where the official content comes from, for the footer's source line (ELWIS terms of use).
  catalogSource: string
}

export const SITES: Record<Site, SiteIdentity> = {
  sks: {
    name: 'SKS Lotse',
    origin: 'https://sks-lotse.de',
    footerLinks: [
      { to: '/exam-process', label: 'Prüfungsablauf' },
      { to: '/learning-method', label: 'Lernmethode' },
      { to: '/faq', label: 'FAQ' },
      { to: '/imprint', label: 'Impressum' },
      { to: '/privacy', label: 'Datenschutz' },
      { to: '/terms', label: 'AGB' },
    ],
    catalogSource: 'Quelle der Prüfungsfragen und Musterantworten: amtlicher Fragenkatalog SKS',
  },
  sbf: {
    name: 'SBF Lotse',
    origin: 'https://sbf-lotse.de',
    footerLinks: [
      { to: '/faq', label: 'FAQ' },
      { to: '/imprint', label: 'Impressum' },
      { to: '/privacy', label: 'Datenschutz' },
    ],
    catalogSource: 'Quelle der Navigationsaufgaben: amtlicher Fragenkatalog für den Sportbootführerschein See',
  },
}
