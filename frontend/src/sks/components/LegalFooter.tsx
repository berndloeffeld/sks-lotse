import { NavLink } from 'react-router-dom'

import { feedbackMailto } from '../contact'
import { SITE_NAME } from '../site'

// `pt-1 -mt-1` and `min-w-6` make a short link ("FAQ", "AGB") a 24 px tap target without moving it.
const TAP_AREA = 'min-w-6 -mt-1 pt-1 text-center'
const FOOTER_LINK = `${TAP_AREA} border-b-2 border-transparent pb-1 hover:border-surface hover:text-surface`

// The page the visitor is on is underlined, like the header's links (HEADER_LINK_ACTIVE).
function footerLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? `${TAP_AREA} border-b-2 border-surface pb-1 text-surface` : FOOTER_LINK
}

// The content pages (Prüfungsablauf, Lernmethode, FAQ), the contact (also the way to send feedback) and the
// legal links. Impressum must be reachable from every page (§5 DDG) — the landing page
// renders this directly, every other page gets it via PageLayout. A
// full-width primary-dark band with the brand centered on top, like the
// template's footer.
const FOOTER_LINKS = [
  { to: '/exam-process', label: 'Prüfungsablauf' },
  { to: '/learning-method', label: 'Lernmethode' },
  { to: '/faq', label: 'FAQ' },
  { to: '/imprint', label: 'Impressum' },
  { to: '/privacy', label: 'Datenschutz' },
  { to: '/terms', label: 'AGB' },
]

export function LegalFooter() {
  return (
    <footer className="bg-primary-dark">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-4 py-8 text-center text-surface-alt">
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-mono text-xs tracking-wide uppercase">
          {FOOTER_LINKS.map(({ to, label }) => (
            <NavLink key={to} to={to} className={footerLinkClass}>
              {label}
            </NavLink>
          ))}
          <a href={feedbackMailto(SITE_NAME)} className={FOOTER_LINK}>
            Kontakt
          </a>
        </nav>
        <p className="font-mono text-2xs">
          © {new Date().getFullYear()} {SITE_NAME}
        </p>
        <p className="max-w-md text-xs">
          Quelle der Prüfungsfragen und Musterantworten: amtlicher Fragenkatalog SKS, Wasserstraßen- und
          Schifffahrtsverwaltung des Bundes (WSV), bereitgestellt über{' '}
          <a
            href="https://www.elwis.de"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-surface"
          >
            ELWIS
          </a>
          .
        </p>
      </div>
    </footer>
  )
}
